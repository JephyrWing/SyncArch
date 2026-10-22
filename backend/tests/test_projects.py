"""TC-PROJ-01~04/TC-TEAM-01~02: 프로젝트와 멤버 권한·트랜잭션·이력."""
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
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import AppUser, Project, ProjectDocument, ProjectMember, ProjectActivity
from app.services import project_service, member_service
from app.services.project_access import require_access
from app.services.project_events import project_changed, access_revoked
from app.repositories import project_repository, member_repository, activity_repository
from app.errors import ProjectArchived, ProjectNotFound

from test_auth import auth_app, login, bearer, PASSWORD


@pytest.fixture
def users(auth_app):
    owner = auth_app.test_client()
    editor = auth_app.test_client()
    outsider = auth_app.test_client()
    with auth_app.app_context():
        user = AppUser(login_id="auth-c", display_name="검증 C", password_hash=generate_password_hash(PASSWORD))
        db.session.add(user)
        db.session.commit()
        outsider_id = user.id
    owner_login = login(owner)
    editor_login = login(editor, loginId="auth-b")
    outsider_login = login(outsider, loginId="auth-c")
    assert all(r.status_code == 200 for r in (owner_login, editor_login, outsider_login))
    return {"app": auth_app, "owner": owner, "editor": editor, "outsider": outsider,
            "owner_id": owner_login.json["data"]["user"]["id"],
            "editor_id": editor_login.json["data"]["user"]["id"], "outsider_id": outsider_id,
            "owner_headers": bearer(owner_login.json["data"]["accessToken"]),
            "editor_headers": bearer(editor_login.json["data"]["accessToken"]),
            "outsider_headers": bearer(outsider_login.json["data"]["accessToken"])}


def create(users, title="설계 프로젝트"):
    response = users["owner"].post("/api/projects", json={"title": title, "summary": "한글 요약"}, headers=users["owner_headers"])
    assert response.status_code == 201
    return response.json["data"]


def add_editor(users, project_id):
    response = users["owner"].post(f"/api/projects/{project_id}/members", json={"loginId": "auth-b"}, headers=users["owner_headers"])
    assert response.status_code == 200
    return response.json["data"]


def counts(app):
    with app.app_context():
        return [db.session.scalar(select(func.count()).select_from(model)) for model in
                (Project, ProjectMember, ProjectDocument, ProjectActivity)]


def test_create_is_atomic_has_v2_empty_document_and_owner(users):
    result = create(users)
    pid = result["id"]
    assert result["ownerId"] == users["owner_id"] and result["role"] == "OWNER"
    assert result["version"] == 1 and result["archived"] is False
    assert result["updatedAt"].endswith("Z")
    assert counts(users["app"]) == [1, 1, 1, 1]
    response = users["owner"].get(f"/api/projects/{pid}/document", headers=users["owner_headers"])
    assert response.status_code == 200
    assert response.json["data"]["payload"] == {"schemaVersion": 2, "ideas": [], "features": [], "nodes": [], "connections": [], "tables": []}
    with users["app"].app_context():
        assert db.session.get(ProjectMember, (pid, users["owner_id"])).role == "OWNER"
        assert db.session.get(ProjectDocument, pid).schema_version == 2


@pytest.mark.parametrize("payload", [{}, {"title": " "}, {"title": "x" * 121}, {"title": "test", "ownerId": "forged"},
    {"title": "test", "targetDbms": "postgres"}, {"title": "test", "summary": "x" * 5001},
    {"title": "test", "payload": {}}, {"title": 12}])
def test_create_invalid_input_never_partially_writes(users, payload):
    response = users["owner"].post("/api/projects", json=payload, headers=users["owner_headers"])
    assert response.status_code == 400
    assert counts(users["app"]) == [0, 0, 0, 0]


@pytest.mark.parametrize("target", ["member", "activity"])
def test_create_rolls_back_all_rows_on_failure(users, target):
    dependency = member_repository if target == "member" else activity_repository
    method = "insert_member" if target == "member" else "insert_activity"
    with patch.object(dependency, method, side_effect=SQLAlchemyError("test-only failure")):
        response = users["owner"].post("/api/projects", json={"title": "원자 생성"}, headers=users["owner_headers"])
    assert response.status_code == 503
    assert counts(users["app"]) == [0, 0, 0, 0]


def test_list_is_member_scoped_and_conditional_get_never_bypasses_access(users):
    project = create(users)
    pid = project["id"]
    assert users["owner"].get("/api/projects", headers=users["owner_headers"]).json["data"][0]["id"] == pid
    assert users["outsider"].get("/api/projects", headers=users["outsider_headers"]).json["data"] == []
    original = users["owner"].get(f"/api/projects/{pid}/document", headers=users["owner_headers"])
    etag = original.headers["ETag"]
    assert original.headers["Cache-Control"] == "private, no-cache"
    assert users["owner"].get(f"/api/projects/{pid}/document", headers={**users["owner_headers"], "If-None-Match": etag}).status_code == 304
    for suffix in ("document", "members"):
        response = users["outsider"].get(f"/api/projects/{pid}/{suffix}", headers={**users["outsider_headers"], "If-None-Match": etag})
        assert response.status_code == 404
        assert project["title"] not in response.get_data(as_text=True)
    assert users["outsider"].post(f"/api/projects/{pid}/clone", json={"sourceVersion": 1, "title": "forbidden"}, headers=users["outsider_headers"]).status_code == 404


def test_template_view_never_persists_and_explicit_clone_preserves_source(users):
    client, headers = users["owner"], users["owner_headers"]
    templates = client.get("/api/project-templates", headers=headers).json["data"]
    assert len(templates) == 2 and counts(users["app"]) == [0, 0, 0, 0]
    original = deepcopy(templates)
    response = client.post(f'/api/project-templates/{templates[0]["id"]}/clone',
        json={"sourceVersion": 1, "title": "명시적 예시 복사"}, headers=headers)
    assert response.status_code == 201
    project = response.json["data"]
    assert project["id"] != templates[0]["id"]
    assert project["ownerId"] == users["owner_id"]
    document = client.get(f'/api/projects/{project["id"]}/document', headers=headers).json["data"]
    assert document["payload"] == templates[0]["payload"]
    assert client.get("/api/project-templates", headers=headers).json["data"] == original
    assert counts(users["app"]) == [1, 1, 1, 1]


def test_project_clone_checks_source_version_and_copies_membership_independently(users):
    project = create(users)
    pid = project["id"]
    add_editor(users, pid)
    editor, headers = users["editor"], users["editor_headers"]
    stale = editor.post(f"/api/projects/{pid}/clone", json={"sourceVersion": 1, "title": "stale"}, headers=headers)
    assert stale.status_code == 409 and stale.json["error"]["currentVersion"] == 2
    result = editor.post(f"/api/projects/{pid}/clone", json={"sourceVersion": 2, "title": "editor copy"}, headers=headers)
    assert result.status_code == 201
    copied = result.json["data"]
    assert copied["ownerId"] == users["editor_id"] and copied["version"] == 1
    members = editor.get(f'/api/projects/{copied["id"]}/members', headers=headers).json["data"]
    assert [(m["id"], m["role"]) for m in members] == [(users["editor_id"], "OWNER")]
    assert users["owner"].get(f'/api/projects/{copied["id"]}/document', headers=users["owner_headers"]).status_code == 404


def test_clone_failure_rolls_back_and_preserves_original(users):
    original = create(users)
    before = counts(users["app"])
    with patch.object(activity_repository, "insert_activity", side_effect=SQLAlchemyError("test-only failure")):
        response = users["owner"].post(f'/api/projects/{original["id"]}/clone', json={"sourceVersion": 1, "title": "rollback"}, headers=users["owner_headers"])
    assert response.status_code == 503
    assert counts(users["app"]) == before
    assert users["owner"].get(f'/api/projects/{original["id"]}/document', headers=users["owner_headers"]).json["data"]["version"] == 1


def test_archive_restore_updates_version_activity_and_write_policy(users):
    project = create(users)
    pid = project["id"]
    add_editor(users, pid)
    client, headers = users["owner"], users["owner_headers"]
    assert users["editor"].patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=users["editor_headers"]).status_code == 403
    result = client.patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=headers)
    assert result.status_code == 200 and result.json["data"]["version"] == 3
    assert client.get("/api/projects", headers=headers).json["data"] == []
    assert len(client.get("/api/projects?archived=true", headers=headers).json["data"]) == 1
    assert len(client.get("/api/projects?archived=all", headers=headers).json["data"]) == 1
    assert client.get(f"/api/projects/{pid}/document", headers=headers).status_code == 200
    assert client.post(f"/api/projects/{pid}/members", json={"loginId": "auth-c"}, headers=headers).json["error"]["code"] == "PROJECT_ARCHIVED"
    with users["app"].app_context(), db.session.session_factory.begin() as session:
        with pytest.raises(ProjectArchived):
            require_access(session, users["editor_id"], pid, lock=True, write=True)
    repeated = client.patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=headers)
    assert repeated.json["data"]["version"] == 3
    restored = client.patch(f"/api/projects/{pid}/archive", json={"archived": False}, headers=headers)
    assert restored.json["data"]["version"] == 4
    with users["app"].app_context():
        assert db.session.scalar(select(func.count()).select_from(ProjectActivity)) == 4
        assert db.session.get(ProjectDocument, pid).version == 4


def test_member_permissions_duplicates_removal_and_owner_protection(users):
    pid = create(users)["id"]
    first = add_editor(users, pid)
    duplicate = add_editor(users, pid)
    assert first == duplicate
    client, headers = users["owner"], users["owner_headers"]
    assert len(client.get(f"/api/projects/{pid}/members", headers=headers).json["data"]) == 2
    for method, path, payload in [
        ("post", f"/api/projects/{pid}/members", {"loginId": "auth-c"}),
        ("delete", f'/api/projects/{pid}/members/{users["owner_id"]}', None),
    ]:
        response = getattr(users["editor"], method)(path, json=payload, headers=users["editor_headers"])
        assert response.status_code == 403
    assert client.delete(f'/api/projects/{pid}/members/{users["owner_id"]}', headers=headers).status_code == 403
    assert client.post(f"/api/projects/{pid}/members", json={"loginId": "auth-a", "role": "EDITOR"}, headers=headers).status_code == 400
    revoked = []
    def on_revoked(sender, **payload):
        revoked.append(payload)
    access_revoked.connect(on_revoked)
    try:
        assert client.delete(f'/api/projects/{pid}/members/{users["editor_id"]}', headers=headers).status_code == 204
    finally:
        access_revoked.disconnect(on_revoked)
    assert revoked == [{"project_id": pid, "user_id": users["editor_id"], "reason": "MEMBER_REMOVED"}]
    assert users["editor"].get(f"/api/projects/{pid}/document", headers=users["editor_headers"]).status_code == 404
    assert users["editor"].get(f"/api/projects/{pid}/members", headers=users["editor_headers"]).status_code == 404
    assert users["editor"].get("/api/projects", headers=users["editor_headers"]).json["data"] == []
    assert client.delete(f'/api/projects/{pid}/members/{users["editor_id"]}', headers=headers).status_code == 204
    with users["app"].app_context():
        assert db.session.get(ProjectMember, (pid, users["owner_id"])).role == "OWNER"
        assert db.session.get(ProjectDocument, pid).version == 3


def test_membership_and_archive_changes_rollback_with_activity_failure(users):
    pid = create(users)["id"]
    with patch.object(activity_repository, "insert_activity", side_effect=SQLAlchemyError("test-only failure")):
        assert users["owner"].post(f"/api/projects/{pid}/members", json={"loginId": "auth-b"}, headers=users["owner_headers"]).status_code == 503
        assert users["owner"].patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=users["owner_headers"]).status_code == 503
    assert counts(users["app"]) == [1, 1, 1, 1]
    with users["app"].app_context():
        assert db.session.get(Project, pid).archived_at is None
        assert db.session.get(ProjectDocument, pid).version == 1


def test_member_removal_rolls_back_and_emits_nothing_on_activity_failure(users):
    pid = create(users)["id"]
    add_editor(users, pid)
    revoked = []
    def observer(sender, **payload):
        revoked.append(payload)
    access_revoked.connect(observer)
    try:
        with patch.object(activity_repository, "insert_activity", side_effect=SQLAlchemyError("test-only failure")):
            response = users["owner"].delete(f'/api/projects/{pid}/members/{users["editor_id"]}', headers=users["owner_headers"])
            assert response.status_code == 503
        assert revoked == []
    finally:
        access_revoked.disconnect(observer)
    assert users["editor"].get(f"/api/projects/{pid}/document", headers=users["editor_headers"]).status_code == 200
    with users["app"].app_context():
        assert db.session.get(ProjectDocument, pid).version == 2
        assert db.session.scalar(select(func.count()).select_from(ProjectActivity)) == 2


def test_missing_and_disabled_member_targets_do_not_change_project(users):
    pid = create(users)["id"]
    with users["app"].app_context():
        db.session.get(AppUser, users["editor_id"]).is_active = False
        db.session.commit()
    for login_id in ("missing-account", "auth-b"):
        response = users["owner"].post(f"/api/projects/{pid}/members", json={"loginId": login_id}, headers=users["owner_headers"])
        assert response.status_code == 404
    assert counts(users["app"]) == [1, 1, 1, 1]


def test_events_run_only_after_commit_and_failure_does_not_undo_success(users):
    pid = create(users)["id"]
    seen = []
    def observer(sender, event):
        with users["app"].app_context(), db.session.session_factory() as session:
            assert session.get(Project, pid).archived_at is not None
            assert session.get(ProjectDocument, pid).version == event["version"]
            seen.append(event["version"])
        raise RuntimeError("test-only notification failure")
    project_changed.connect(observer)
    try:
        response = users["owner"].patch(f"/api/projects/{pid}/archive", json={"archived": True}, headers=users["owner_headers"])
        assert response.status_code == 200
        assert seen == [2]
    finally:
        project_changed.disconnect(observer)
    assert users["owner"].get(f"/api/projects/{pid}/document", headers=users["owner_headers"]).json["data"]["version"] == 2


def test_activity_migration_preserves_old_payload_and_downgrade(app):
    directory = str(Path(__file__).resolve().parents[1] / "migrations")
    with app.app_context():
        upgrade(directory=directory, revision="0002")
        # 0002에는 이메일 열이 없으므로 당시 열만 사용해 기존 사용자를 만듭니다.
        actor_id = str(uuid4())
        db.session.execute(text("INSERT INTO app_users (id, login_id, display_name, password_hash, is_active, created_at) "
            "VALUES (:id, 'migration-owner', :name, '!disabled', 1, CURRENT_TIMESTAMP)"), {"id": actor_id, "name": "보존"})
        # 이후 마이그레이션이 projects에 열을 더하므로 프로젝트도 0002 당시 열만 사용해 만듭니다.
        pid = str(uuid4())
        db.session.execute(text("INSERT INTO projects (id, owner_id, title, summary, category_tag, target_dbms, created_at, updated_at) "
            "VALUES (:id, :owner, '이전 문서', '', '', 'mariadb', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"), {"id": pid, "owner": actor_id})
        payload = {"schemaVersion": 1, "marker": "보존 🚀", "unknown": [1, 2]}
        db.session.add(ProjectDocument(project_id=pid, payload=payload, updated_by=actor_id))
        db.session.commit()
        # DDL 전 읽기 트랜잭션을 끝내 새 테이블을 이전 snapshot에서 조회하지 않습니다.
        db.session.remove()
        upgrade(directory=directory)
        assert db.session.get(ProjectDocument, pid).payload == payload
        assert db.session.scalar(select(func.count()).select_from(ProjectActivity)) == 0
        db.session.remove()
        downgrade(directory=directory, revision="0002")
        assert db.session.get(ProjectDocument, pid).payload == payload


@pytest.mark.mariadb
def test_real_mariadb_project_lock_serializes_duplicate_member_add(users):
    with users["app"].app_context():
        assert db.engine.dialect.name in {"mysql", "mariadb"}
    pid = create(users)["id"]
    barrier = Barrier(2)
    def add():
        with users["app"].app_context():
            barrier.wait(timeout=10)
            return member_service.add_member(db.session.session_factory, users["owner_id"], pid, "auth-b")
    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(lambda _: add(), range(2)))
    assert result[0]["id"] == result[1]["id"]
    with users["app"].app_context():
        assert db.session.get(ProjectDocument, pid).version == 2
        assert db.session.scalar(select(func.count()).select_from(ProjectActivity)) == 2


@pytest.mark.mariadb
def test_real_mariadb_permission_check_after_waiting_project_lock(users):
    with users["app"].app_context():
        assert db.engine.dialect.name in {"mysql", "mariadb"}
    pid = create(users)["id"]
    add_editor(users, pid)
    lock_held, request_started, release_lock = Event(), Event(), Event()
    def remove_then_commit():
        with users["app"].app_context(), db.session.session_factory.begin() as session:
            project_repository.find_project(session, pid, lock=True)
            lock_held.set()
            assert release_lock.wait(timeout=15)
            member = member_repository.find_member(session, pid, users["editor_id"], lock=True)
            member_repository.delete_member(session, member)
    def check_after_wait():
        assert lock_held.wait(timeout=15)
        with users["app"].app_context(), db.session.session_factory.begin() as session:
            request_started.set()
            try:
                require_access(session, users["editor_id"], pid, lock=True, write=True)
            except ProjectNotFound:
                return "denied"
            return "allowed"
    with ThreadPoolExecutor(max_workers=2) as pool:
        removal = pool.submit(remove_then_commit)
        check = pool.submit(check_after_wait)
        assert request_started.wait(timeout=15)
        with pytest.raises(FutureTimeout):
            check.result(timeout=0.2)
        release_lock.set()
        removal.result(timeout=20)
        assert check.result(timeout=20) == "denied"
