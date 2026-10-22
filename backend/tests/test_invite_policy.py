"""TC-TEAM-01: 초대 정책의 객체 권한과 거부 시 DB 불변성을 검증합니다."""
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
import re
from threading import Barrier

import pytest
from sqlalchemy import select

from app.extensions import db
from app.models import Project, ProjectMember, ProjectDocument, ProjectActivity, DocumentMutation
from app.services import invite_service
from test_auth import auth_app  # noqa: F401
from test_projects import users, create, add_editor  # noqa: F401


def invite_state(app, project_id):
    with app.app_context():
        db.session.remove()
        result = {}
        for model in (Project, ProjectMember, ProjectDocument, ProjectActivity, DocumentMutation):
            key = model.id if model is Project else model.project_id
            rows = db.session.scalars(select(model).where(key == project_id)).all()
            values = [{column.key: deepcopy(getattr(row, column.key)) for column in model.__table__.columns} for row in rows]
            result[model.__name__] = sorted(values, key=lambda row: str(sorted(row.items())))
        db.session.remove()
        return result


def denied(response, status, code):
    assert response.status_code == status, response.json
    assert response.json["error"]["code"] == code
    assert "data" not in response.json


def test_invite_rotation_preserves_roles_and_join_is_atomic_and_idempotent(users):
    pid = create(users)["id"]
    owner, outsider = users["owner"], users["outsider"]
    oh, ch = users["owner_headers"], users["outsider_headers"]
    add_editor(users, pid)
    path = f"/api/projects/{pid}/invite"
    old = owner.get(path, headers=oh).json["data"]["code"]
    assert re.fullmatch(r"[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}", old)
    before = invite_state(users["app"], pid)
    assert owner.get(path, headers=oh).json["data"]["code"] == old
    assert invite_state(users["app"], pid) == before
    rotated = owner.post(path, headers=oh)
    assert rotated.status_code == 200
    new = rotated.json["data"]["code"]
    assert new != old and re.fullmatch(r"[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}", new)
    expected = deepcopy(before)
    expected["Project"][0]["invite_code"] = new
    rotated_state = invite_state(users["app"], pid)
    # 초대 코드를 바꾸면 모델의 onupdate가 프로젝트 수정 시각만 갱신한다.
    assert rotated_state["Project"][0]["updated_at"] >= before["Project"][0]["updated_at"]
    expected["Project"][0]["updated_at"] = rotated_state["Project"][0]["updated_at"]
    assert rotated_state == expected
    denied(outsider.post("/api/projects/join", headers=ch, json={"code": old}), 404, "NOT_FOUND")
    denied(outsider.post("/api/projects/join", headers=ch, json={"code": "00000000"}), 404, "NOT_FOUND")
    denied(outsider.post("/api/projects/join", headers=ch, json={"code": " - "}), 400, "BAD_REQUEST")
    denied(outsider.post("/api/projects/join", json={"code": new}), 401, "AUTH_REQUIRED")
    assert invite_state(users["app"], pid) == expected
    assert owner.post("/api/projects/join", headers=oh, json={"code": new}).json["data"]["role"] == "OWNER"
    assert invite_state(users["app"], pid) == expected
    joined = outsider.post("/api/projects/join", headers=ch, json={"code": new})
    assert joined.status_code == 200 and joined.json["data"]["role"] == "EDITOR"
    after = invite_state(users["app"], pid)
    assert len(after["ProjectMember"]) == len(before["ProjectMember"]) + 1
    assert after["ProjectDocument"][0]["version"] == before["ProjectDocument"][0]["version"] + 1
    assert len(after["ProjectActivity"]) == len(before["ProjectActivity"]) + 1
    assert after["ProjectDocument"][0]["payload"] == before["ProjectDocument"][0]["payload"]
    assert outsider.post("/api/projects/join", headers=ch, json={"code": new}).json["data"]["role"] == "EDITOR"
    assert invite_state(users["app"], pid) == after
    assert {(row["user_id"], row["role"]) for row in after["ProjectMember"]} == {
        (users["owner_id"], "OWNER"), (users["editor_id"], "EDITOR"), (users["outsider_id"], "EDITOR")}


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_invite_authentication_roles_removed_member_and_object_scope(users, method):
    pid = create(users)["id"]
    add_editor(users, pid)
    path = f"/api/projects/{pid}/invite"
    before = invite_state(users["app"], pid)
    denied(users["owner"].open(path, method=method), 401, "AUTH_REQUIRED")
    denied(users["editor"].open(path, method=method, headers=users["editor_headers"]), 403, "FORBIDDEN")
    denied(users["outsider"].open(path, method=method, headers=users["outsider_headers"]), 404, "NOT_FOUND")
    denied(users["outsider"].get(f"/api/projects/{pid}/document", headers=users["outsider_headers"]), 404, "NOT_FOUND")
    assert invite_state(users["app"], pid) == before
    assert users["owner"].delete(f"/api/projects/{pid}/members/{users['editor_id']}", headers=users["owner_headers"]).status_code == 204
    removed = invite_state(users["app"], pid)
    denied(users["editor"].open(path, method=method, headers=users["editor_headers"]), 404, "NOT_FOUND")
    denied(users["editor"].get(f"/api/projects/{pid}/document", headers=users["editor_headers"]), 404, "NOT_FOUND")
    assert invite_state(users["app"], pid) == removed
    other = users["outsider"].post("/api/projects", headers=users["outsider_headers"], json={"title": "다른 소유자의 프로젝트"}).json["data"]["id"]
    other_before = invite_state(users["app"], other)
    denied(users["owner"].open(f"/api/projects/{other}/invite", method=method, headers=users["owner_headers"]), 404, "NOT_FOUND")
    assert invite_state(users["app"], other) == other_before


@pytest.mark.parametrize("has_code", [True, False])
def test_archived_invite_requests_never_mutate_and_restore_keeps_policy(users, has_code):
    pid = create(users)["id"]
    owner, outsider = users["owner"], users["outsider"]
    oh, ch = users["owner_headers"], users["outsider_headers"]
    path = f"/api/projects/{pid}/invite"
    code = owner.get(path, headers=oh).json["data"]["code"] if has_code else None
    assert owner.patch(f"/api/projects/{pid}/archive", headers=oh, json={"archived": True}).status_code == 200
    before = invite_state(users["app"], pid)
    # 처음 실패해도 나머지 요청을 실행해 조회·재발급의 실제 상태를 모두 남깁니다.
    results = [owner.get(path, headers=oh)]
    if has_code:
        results.append(outsider.post("/api/projects/join", headers=ch, json={"code": code}))
    results.append(owner.post(path, headers=oh))
    assert [(r.status_code, r.json.get("error", {}).get("code")) for r in results] == [(403, "PROJECT_ARCHIVED")] * len(results)
    assert invite_state(users["app"], pid) == before
    assert owner.patch(f"/api/projects/{pid}/archive", headers=oh, json={"archived": False}).status_code == 200
    restored = owner.get(path, headers=oh).json["data"]["code"]
    if has_code:
        assert restored == code
    else:
        assert re.fullmatch(r"[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}", restored)
    assert owner.get(path, headers=oh).json["data"]["code"] == restored
    assert outsider.post("/api/projects/join", headers=ch, json={"code": restored}).json["data"]["role"] == "EDITOR"


@pytest.mark.mariadb
def test_concurrent_code_join_creates_one_membership_version_and_activity(users):
    pid = create(users)["id"]
    code = users["owner"].get(f"/api/projects/{pid}/invite", headers=users["owner_headers"]).json["data"]["code"]
    before = invite_state(users["app"], pid)
    barrier = Barrier(2)

    def join():
        with users["app"].app_context():
            barrier.wait(timeout=10)
            return invite_service.join_by_code(db.session.session_factory, users["editor_id"], code)

    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(lambda _: join(), range(2)))
    assert all(row["id"] == pid and row["role"] == "EDITOR" and row["version"] == 2 for row in result)
    after = invite_state(users["app"], pid)
    assert len(after["ProjectMember"]) == len(before["ProjectMember"]) + 1
    assert len(after["ProjectActivity"]) == len(before["ProjectActivity"]) + 1
    assert after["ProjectDocument"][0]["version"] == 2
