"""W05: TC-SAVE-01/04, COL-02/06, SAFE-01/02, AUTH-02, DASH-01의 API·DB 검증."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from copy import deepcopy
from pathlib import Path
from threading import Barrier, Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_migrate import upgrade, downgrade
from sqlalchemy import select, func, text
from sqlalchemy.exc import SQLAlchemyError

from app.errors import ProjectNotFound, VersionConflict
from app.extensions import db
from app.models import Project, ProjectDocument, DocumentMutation, ProjectActivity, AppUser
from app.repositories import document_repository, activity_repository
from app.schemas.document_schema import save_input
from app.services import document_service, member_service
from app.services.project_events import project_changed

from test_auth import auth_app
from test_projects import users, create, add_editor
from test_document_schema import empty, idea, valid_payload


def request_for(users, pid, **updates):
    response = users["owner"].get(f"/api/projects/{pid}/document", headers=users["owner_headers"])
    assert response.status_code == 200
    data = response.json["data"]
    fields = {k: data["project"][k] for k in ("title", "summary", "categoryTag", "targetDbms")}
    return {"baseVersion": data["version"], "mutationId": str(uuid4()), "project": fields,
        "payload": deepcopy(data["payload"]), **updates}


def put(users, pid, request, who="owner"):
    return users[who].put(f"/api/projects/{pid}/document", json=request, headers=users[who + "_headers"])


def snapshot(users, pid):
    with users["app"].app_context():
        p, d = db.session.get(Project, pid), db.session.get(ProjectDocument, pid)
        return {"title": p.title, "summary": p.summary, "category": p.category_tag, "version": d.version,
            "schema": d.schema_version, "payload": deepcopy(d.payload), "by": d.updated_by, "at": d.updated_at,
            "mutations": db.session.scalar(select(func.count()).select_from(DocumentMutation)),
            "activities": db.session.scalar(select(func.count()).select_from(ProjectActivity))}


def service_save(users, pid, request, actor="owner"):
    fields, conversions = save_input(request)
    with users["app"].app_context():
        return document_service.save_document(db.session.session_factory, users[actor + "_id"], pid, fields, conversions)


def test_save_metadata_payload_result_and_event_are_committed_together(users):
    pid = create(users)["id"]
    request = request_for(users, pid)
    request["project"].update(title="변경된 이름", summary="변경 요약", categoryTag="새 분류")
    request["payload"]["ideas"] = [idea(comments=[{"id": str(uuid4()), "text": "새 댓글"}])]
    seen = []
    def observer(sender, event):
        state = snapshot(users, pid)
        assert state["title"] == "변경된 이름" and state["mutations"] == 1 and state["activities"] == 2
        assert state["version"] == event["version"] == 2
        assert event["mutationId"] == request["mutationId"]
        seen.append(event)
    project_changed.connect(observer)
    try:
        response = put(users, pid, request)
    finally:
        project_changed.disconnect(observer)
    assert response.status_code == 200
    result = response.json["data"]
    assert result["version"] == 2 and result["replayed"] is False
    assert result["project"]["title"] == "변경된 이름" and result["updatedAt"].endswith("Z")
    comment = result["payload"]["ideas"][0]["comments"][0]
    assert comment["authorId"] == users["owner_id"] and comment["createdAt"].endswith("Z")
    assert len(seen) == 1 and seen[0]["eventId"] == result["eventId"]
    assert {c["area"] for c in seen[0]["changes"]} == {"project", "ideas"}
    assert response.headers["Cache-Control"] == "no-store"
    get = users["owner"].get(f"/api/projects/{pid}/document", headers=users["owner_headers"])
    assert get.headers["ETag"] == response.headers["ETag"]
    assert get.json["data"]["payload"] == result["payload"]


def test_replay_precedes_stale_version_and_returns_original_snapshot_without_event(users):
    pid = create(users)["id"]
    request = request_for(users, pid)
    request["project"]["title"] = "첫 결과"
    first = put(users, pid, request)
    assert first.status_code == 200
    later = request_for(users, pid)
    later["project"]["title"] = "더 최신 이름"
    assert put(users, pid, later).status_code == 200
    before = snapshot(users, pid)
    seen = []
    def observer(sender, event):
        seen.append(event)
    project_changed.connect(observer)
    try:
        replay = put(users, pid, request)
    finally:
        project_changed.disconnect(observer)
    assert replay.status_code == 200 and replay.json["data"] == {**first.json["data"], "replayed": True}
    assert replay.json["data"]["version"] == 2 and replay.json["data"]["project"]["title"] == "첫 결과"
    assert snapshot(users, pid) == before and seen == []


def test_idempotency_key_cannot_be_reused_with_different_body_or_actor(users):
    pid = create(users)["id"]
    add_editor(users, pid)
    request = request_for(users, pid)
    assert put(users, pid, request).status_code == 200
    before = snapshot(users, pid)
    changed = deepcopy(request)
    changed["project"]["title"] = "다른 본문"
    for body, who in ((changed, "owner"), (request, "editor")):
        response = put(users, pid, body, who)
        assert response.status_code == 409 and response.json["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert snapshot(users, pid) == before


def test_canonical_key_order_and_metadata_defaults_replay_identically(users):
    pid = create(users)["id"]
    request = request_for(users, pid)
    request["project"] = {"title": "같은 요청"}
    first = put(users, pid, request)
    assert first.status_code == 200
    request["project"] = {"summary": "", "targetDbms": "mariadb", "categoryTag": "", "title": "같은 요청"}
    assert put(users, pid, request).json["data"] == {**first.json["data"], "replayed": True}


def test_stale_version_is_409_and_never_writes_metadata_or_mutation(users):
    pid = create(users)["id"]
    stale = request_for(users, pid)
    assert put(users, pid, stale).status_code == 200
    stale["mutationId"] = str(uuid4())
    stale["project"]["title"] = "덮어쓰기 금지"
    before = snapshot(users, pid)
    response = put(users, pid, stale)
    assert response.status_code == 409 and response.json["error"]["currentVersion"] == 2
    assert snapshot(users, pid) == before


@pytest.mark.parametrize("stage", ["cas", "activity", "mutation"])
def test_save_failure_rolls_back_every_write_and_emits_nothing(users, stage):
    pid = create(users)["id"]
    request = request_for(users, pid)
    request["project"]["title"] = "롤백할 이름"
    request["payload"]["ideas"] = [idea()]
    before, seen = snapshot(users, pid), []
    def observer(sender, event):
        seen.append(event)
    dependency, method = {"cas": (document_repository, "compare_and_swap"),
        "activity": (activity_repository, "insert_activity"), "mutation": (document_repository, "insert_mutation")}[stage]
    project_changed.connect(observer)
    try:
        with patch.object(dependency, method, side_effect=SQLAlchemyError("test-only")):
            response = put(users, pid, request)
    finally:
        project_changed.disconnect(observer)
    assert response.status_code == 503 and snapshot(users, pid) == before and seen == []
    assert put(users, pid, request).status_code == 200


def test_cas_zero_rows_rolls_back_and_notification_failure_preserves_commit(users):
    pid = create(users)["id"]
    request = request_for(users, pid)
    before = snapshot(users, pid)
    with patch.object(document_repository, "compare_and_swap", return_value=0):
        assert put(users, pid, request).status_code == 409
    assert snapshot(users, pid) == before
    seen = []
    def broken_observer(sender, event):
        assert snapshot(users, pid)["version"] == 2
        seen.append(event["eventId"])
        raise RuntimeError("test-only notification failure")
    project_changed.connect(broken_observer)
    try:
        response = put(users, pid, request)
    finally:
        project_changed.disconnect(broken_observer)
    assert response.status_code == 200 and len(seen) == 1
    assert users["owner"].get(f"/api/projects/{pid}/activity", headers=users["owner_headers"]).json["data"]["items"][0]["eventId"] == seen[0]


def test_api_size_structure_and_json_errors_leave_state_unchanged(users):
    pid = create(users)["id"]
    before = snapshot(users, pid)
    request = request_for(users, pid)
    request["payload"]["ideas"] = [idea(authorId=users["outsider_id"])]
    response = put(users, pid, request)
    assert response.status_code == 422 and response.json["error"]["fieldErrors"]
    url = f"/api/projects/{pid}/document"
    bad_json = users["owner"].put(url, data="{", content_type="application/json", headers=users["owner_headers"])
    assert bad_json.status_code == 400
    too_big = users["owner"].put(url, data='{"text":"' + "한" * 400000 + '"}', content_type="application/json", headers=users["owner_headers"])
    assert too_big.status_code == 413 and too_big.json["error"]["code"] == "DOCUMENT_TOO_LARGE"
    assert snapshot(users, pid) == before


def test_current_membership_archive_and_redis_session_are_required_even_for_replay(users):
    pid = create(users)["id"]
    add_editor(users, pid)
    request = request_for(users, pid)
    assert put(users, pid, request, "editor").status_code == 200
    assert put(users, pid, request, "outsider").status_code == 404
    users["owner"].delete(f'/api/projects/{pid}/members/{users["editor_id"]}', headers=users["owner_headers"])
    assert put(users, pid, request, "editor").status_code == 404
    own = request_for(users, pid)
    assert put(users, pid, own).status_code == 200
    users["owner"].patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=users["owner_headers"])
    assert put(users, pid, own).json["error"]["code"] == "PROJECT_ARCHIVED"
    before = snapshot(users, pid)
    from redis.exceptions import ConnectionError
    with patch.object(users["app"].extensions["token_repository"].client, "hmget", side_effect=ConnectionError("test-only")):
        assert put(users, pid, own).status_code == 503
    assert snapshot(users, pid) == before


def test_authors_votes_timestamps_are_protected_and_removed_users_history_survives(users):
    pid = create(users)["id"]
    add_editor(users, pid)
    request = request_for(users, pid)
    request["payload"]["ideas"] = [idea(voterIds=[users["owner_id"]], comments=[{"id": str(uuid4()), "text": "원본"}])]
    first = put(users, pid, request).json["data"]
    for key, value in (("authorId", users["editor_id"]), ("createdAt", "1900-01-01T00:00:00Z"), ("text", "타인 수정")):
        request = request_for(users, pid)
        request["payload"]["ideas"][0]["comments"][0][key] = value
        assert put(users, pid, request, "editor").status_code == 422
    request = request_for(users, pid)
    request["payload"]["ideas"][0]["voterIds"] = []
    assert put(users, pid, request, "editor").status_code == 422
    request = request_for(users, pid)
    request["payload"]["ideas"][0]["voterIds"].append(users["editor_id"])
    response = put(users, pid, request, "editor")
    assert response.status_code == 200
    request = request_for(users, pid)
    request["payload"]["ideas"][0]["comments"].append({"id": str(uuid4()), "text": "편집자 기록"})
    assert put(users, pid, request, "editor").status_code == 200
    users["owner"].delete(f'/api/projects/{pid}/members/{users["editor_id"]}', headers=users["owner_headers"])
    retained = request_for(users, pid)["payload"]["ideas"][0]
    assert retained["comments"][0] == first["payload"]["ideas"][0]["comments"][0]
    assert retained["comments"][1]["authorId"] == users["editor_id"]
    assert users["editor_id"] in retained["voterIds"]


def test_activity_cursor_dashboard_permissions_progress_and_deleted_label(users):
    pid = create(users)["id"]
    headers = users["owner_headers"]
    assert users["owner"].get(f"/api/projects/{pid}/dashboard", headers=headers).json["data"]["progress"] == 0
    request = request_for(users, pid)
    request["payload"]["ideas"] = [idea(title="삭제 뒤에도 남을 이름")]
    request["payload"]["features"] = [{"id": str(uuid4()), "name": "완료", "status": "COMPLETED"},
        {"id": str(uuid4()), "name": "진행", "status": "IN_PROGRESS"}]
    assert put(users, pid, request).status_code == 200
    request = request_for(users, pid)
    request["payload"]["ideas"] = []
    assert put(users, pid, request).status_code == 200
    dashboard = users["owner"].get(f"/api/projects/{pid}/dashboard", headers=headers).json["data"]
    assert dashboard["version"] == 3 and dashboard["progress"] == 50
    assert dashboard["counts"]["features"] == 2 and dashboard["featureStatuses"]["COMPLETED"] == 1
    assert dashboard["recentActivity"][0]["version"] == dashboard["version"]
    assert dashboard["recentActivity"][0]["changes"][0]["label"] == "삭제 뒤에도 남을 이름"
    page = users["owner"].get(f"/api/projects/{pid}/activity?limit=1", headers=headers).json["data"]
    assert page["items"][0]["version"] == 3 and page["nextBeforeVersion"] == 3
    next_page = users["owner"].get(f"/api/projects/{pid}/activity?beforeVersion=3&limit=1000", headers=headers).json["data"]
    assert [a["version"] for a in next_page["items"]] == [2, 1] and next_page["nextBeforeVersion"] is None
    for suffix in ("activity", "dashboard"):
        assert users["outsider"].get(f"/api/projects/{pid}/{suffix}", headers=users["outsider_headers"]).status_code == 404
    for query in ("limit=0", "beforeVersion=-1", "limit=abc", "actorId=forged"):
        assert users["owner"].get(f"/api/projects/{pid}/activity?{query}", headers=headers).status_code == 422


def test_legacy_template_can_be_saved_as_v2_without_changing_original_or_historical_authors(users):
    templates = users["owner"].get("/api/project-templates", headers=users["owner_headers"]).json["data"]
    for template in templates:
        response = users["owner"].post(f'/api/project-templates/{template["id"]}/clone',
            json={"sourceVersion": 1, "title": "v1 이전"}, headers=users["owner_headers"])
        pid = response.json["data"]["id"]
        request = request_for(users, pid)
        saved = put(users, pid, request)
        assert saved.status_code == 200
        data = saved.json["data"]
        assert data["payload"]["schemaVersion"] == 2 and data["normalizations"]
        assert data["payload"]["archVersions"] == template["payload"]["archVersions"]
        assert [i["comments"] for i in data["payload"]["ideas"]] == [i["comments"] for i in template["payload"]["ideas"]]
        assert put(users, pid, request).json["data"]["eventId"] == data["eventId"]
    assert users["owner"].get("/api/project-templates", headers=users["owner_headers"]).json["data"] == templates


def test_mutation_snapshot_migration_preserves_existing_rows_and_can_downgrade(app):
    directory = str(Path(__file__).resolve().parents[1] / "migrations")
    with app.app_context():
        upgrade(directory=directory, revision="0003")
        actor_id, pid, mid = str(uuid4()), str(uuid4()), str(uuid4())
        db.session.execute(text("INSERT INTO app_users (id,login_id,display_name,password_hash,is_active,created_at) VALUES (:id,'old','이전','!disabled',1,CURRENT_TIMESTAMP)"), {"id": actor_id})
        db.session.execute(text("INSERT INTO projects (id,owner_id,title,summary,category_tag,target_dbms,created_at,updated_at) VALUES (:id,:actor,'이전','','','mariadb',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"), {"id": pid, "actor": actor_id})
        db.session.execute(text("INSERT INTO document_mutations (project_id,mutation_id,actor_id,request_hash,result_version,result_updated_at,created_at) VALUES (:pid,:mid,:actor,:hash,7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"), {"pid": pid, "mid": mid, "actor": actor_id, "hash": "a" * 64})
        db.session.commit()
        db.session.remove()
        upgrade(directory=directory)
        record = db.session.get(DocumentMutation, (pid, mid))
        assert record.result_data is None and record.result_version == 7 and record.request_hash == "a" * 64
        db.session.remove()
        downgrade(directory=directory, revision="0003")
        assert db.session.execute(text("SELECT result_version FROM document_mutations WHERE project_id=:pid"), {"pid": pid}).scalar_one() == 7


@pytest.mark.mariadb
@pytest.mark.parametrize("same_mutation", [False, True])
def test_mariadb_concurrent_cas_and_identical_retry(users, same_mutation):
    pid = create(users)["id"]
    if not same_mutation:
        add_editor(users, pid)
    request = request_for(users, pid)
    base_version = request["baseVersion"]
    requests = [deepcopy(request), deepcopy(request)]
    if not same_mutation:
        requests[1]["mutationId"] = str(uuid4())
    barrier = Barrier(2)
    def save(work):
        body, actor = work
        barrier.wait(timeout=10)
        try:
            return service_save(users, pid, body, actor)
        except VersionConflict:
            return "conflict"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, zip(requests, ["owner", "owner" if same_mutation else "editor"])))
    assert snapshot(users, pid)["version"] == base_version + 1 and snapshot(users, pid)["mutations"] == 1
    if same_mutation:
        assert sorted(r["replayed"] for r in results) == [False, True]
        assert results[0]["eventId"] == results[1]["eventId"]
    else:
        assert sum(r == "conflict" for r in results) == 1


@pytest.mark.mariadb
@pytest.mark.parametrize("save_first", [False, True])
def test_mariadb_save_and_member_removal_follow_same_project_lock(users, save_first):
    pid = create(users)["id"]
    add_editor(users, pid)
    request = request_for(users, pid)
    request["project"]["title"] = "경쟁 저장"
    held, release, waiting = Event(), Event(), Event()
    original = document_repository.compare_and_swap if save_first else activity_repository.insert_activity
    def pause(*args, **kwargs):
        result = original(*args, **kwargs)
        held.set()
        assert release.wait(timeout=20)
        return result
    def save():
        return service_save(users, pid, request, "editor")
    def remove():
        with users["app"].app_context():
            return member_service.remove_member(db.session.session_factory, users["owner_id"], pid, users["editor_id"])
    first, second = (save, remove) if save_first else (remove, save)
    target, method = (document_repository, "compare_and_swap") if save_first else (activity_repository, "insert_activity")
    def wait_then_second():
        assert held.wait(timeout=20)
        waiting.set()
        return second()
    with patch.object(target, method, side_effect=pause), ThreadPoolExecutor(max_workers=2) as pool:
        leading = pool.submit(first)
        trailing = pool.submit(wait_then_second)
        assert waiting.wait(timeout=20)
        with pytest.raises(FutureTimeout):
            trailing.result(timeout=0.2)
        release.set()
        leading.result(timeout=20)
        if save_first:
            trailing.result(timeout=20)
        else:
            with pytest.raises(ProjectNotFound):
                trailing.result(timeout=20)
    assert snapshot(users, pid)["title"] == ("경쟁 저장" if save_first else "설계 프로젝트")
    assert put(users, pid, request_for(users, pid), "editor").status_code == 404
