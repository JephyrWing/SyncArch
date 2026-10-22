"""TC-AUTH-05: 공개 가입의 입력·트랜잭션·로그인·권한 경계입니다."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from uuid import UUID

import pytest
from redis.exceptions import ConnectionError
from sqlalchemy import event, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import AppUser, ProjectMember, UserIdentity
from app.services import auth_service
from test_auth import auth_app, ORIGIN, PASSWORD, bearer, csrf, refresh, login
from test_social_auth import google_app, signer, certificate_transport, start_google, callback


def register(client, **changes):
    return client.post("/api/auth/register", headers={"Origin": ORIGIN},
                       json={"loginId": "new-user", "displayName": "새 사용자", "password": PASSWORD, **changes})


@pytest.fixture
def registration_app(app):
    app.config["ALLOWED_ORIGINS"] = [ORIGIN]
    with app.app_context():
        db.create_all()
    return app


def test_registration_commits_public_user_hash_and_no_session_or_membership(registration_app):
    app = registration_app
    client = app.test_client()
    response = register(client, loginId=" new-user ", displayName=" 새 사용자 ", password="  spaced-password  ",
                        email=" New.User@GMAIL.com ")
    assert response.status_code == 201
    user = response.json["data"]["user"]
    assert response.json == {"data": {"user": {"id": user["id"], "loginId": "new-user", "displayName": "새 사용자"}}}
    assert UUID(user["id"]).version == 4
    assert not response.headers.getlist("Set-Cookie")
    assert response.headers["Cache-Control"] == "no-store"
    with app.app_context():
        saved = db.session.get(AppUser, user["id"])
        assert saved.is_active and saved.created_at
        assert saved.password_hash != "  spaced-password  "
        assert check_password_hash(saved.password_hash, "  spaced-password  ")
        assert not check_password_hash(saved.password_hash, "spaced-password")
        assert saved.email == "New.User@GMAIL.com" and saved.email_normalized == "new.user@gmail.com"
        assert saved.email_verified_at is None
        assert db.session.scalar(select(func.count()).select_from(ProjectMember)) == 0
        assert db.session.scalar(select(func.count()).select_from(UserIdentity)) == 0


@pytest.mark.parametrize("changes", [
    {"loginId": ""}, {"loginId": " \t "}, {"loginId": "x" * 101}, {"loginId": 2},
    {"displayName": ""}, {"displayName": "  "}, {"displayName": "x" * 81}, {"displayName": []},
    {"password": "1234567"}, {"password": "x" * 129}, {"password": None},
    {"email": ""}, {"email": None}, {"email": "a..b@gmail.com"}, {"email": "한글@gmail.com"},
    {"id": "client-id"}, {"isActive": False}, {"role": "OWNER"}, {"projectId": "x"},
    {"passwordConfirmation": PASSWORD},
])
def test_registration_rejects_invalid_values_and_injected_fields(registration_app, changes):
    response = register(registration_app.test_client(), **changes)
    assert response.status_code == 400 and response.json["error"]["code"] == "BAD_REQUEST"
    with registration_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(AppUser)) == 0


@pytest.mark.parametrize("payload", [None, [], {}, {"loginId": "x", "password": PASSWORD},
    {"displayName": "이름", "password": PASSWORD}, {"loginId": "x", "displayName": "이름"}])
def test_registration_requires_exact_json(registration_app, payload):
    response = registration_app.test_client().post("/api/auth/register", json=payload, headers={"Origin": ORIGIN})
    assert response.status_code == 400


@pytest.mark.parametrize("origin", [None, "null", "https://evil.example", "http://localhost.evil.example"])
def test_registration_rejects_bad_origin_and_content_type(registration_app, origin):
    client = registration_app.test_client()
    response = client.post("/api/auth/register", json={"loginId": "x", "displayName": "x", "password": PASSWORD},
                           headers={"Origin": origin} if origin else {})
    assert response.status_code == 400 and response.json["error"]["code"] == "CSRF_FAILED"
    assert client.post("/api/auth/register", data="{}", headers={"Origin": ORIGIN}).status_code == 400
    assert client.post("/api/auth/register", data="{", content_type="application/json",
                       headers={"Origin": ORIGIN}).status_code == 400


@pytest.mark.parametrize("length", [8, 128])
def test_registration_accepts_boundaries_without_truncation(registration_app, length):
    client = registration_app.test_client()
    response = register(client, loginId="x" * 100, displayName="이" * 80, password=" " * length)
    assert response.status_code == 201
    with registration_app.app_context():
        user = db.session.get(AppUser, response.json["data"]["user"]["id"])
        assert check_password_hash(user.password_hash, " " * length)
        assert user.email is None and user.email_normalized is None
    assert register(client, loginId="y", displayName="이", password="12345678").status_code == 201


@pytest.mark.parametrize("duplicate_email", [False, True])
def test_duplicate_registration_never_overwrites_existing_account(registration_app, duplicate_email):
    client = registration_app.test_client()
    first = register(client, email="Owner@GMAIL.com")
    changes = {"loginId": "another", "email": " owner@gmail.COM "} if duplicate_email else {}
    result = register(client, password="replacement-password", displayName="덮어쓰기", **changes)
    assert result.status_code == 409 and result.json["error"]["code"] == "REGISTRATION_CONFLICT"
    assert not result.headers.getlist("Set-Cookie")
    with registration_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(AppUser)) == 1
        saved = db.session.get(AppUser, first.json["data"]["user"]["id"])
        assert saved.display_name == "새 사용자" and check_password_hash(saved.password_hash, PASSWORD)
    assert register(client, loginId="after-conflict").status_code == 201


@pytest.mark.parametrize("stage", ["flush", "commit"])
def test_registration_database_failure_rolls_back_without_leaking_secrets(registration_app, stage, caplog):
    def fail(session, *args):
        raise SQLAlchemyError("private-password SQL INSERT private-bindings")
    name = "before_flush" if stage == "flush" else "before_commit"
    event.listen(Session, name, fail)
    try:
        response = register(registration_app.test_client())
    finally:
        event.remove(Session, name, fail)
    assert response.status_code == 503 and response.json["error"]["code"] == "DB_UNAVAILABLE"
    assert not response.headers.getlist("Set-Cookie")
    for secret in ("private-password", "INSERT", "private-bindings", PASSWORD):
        assert secret not in response.get_data(as_text=True) and secret not in caplog.text
    with registration_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(AppUser)) == 0
    assert register(registration_app.test_client()).status_code == 201


def test_new_account_login_refresh_logout_and_project_visibility(auth_app):
    owner = auth_app.test_client()
    owner_token = login(owner).json["data"]["accessToken"]
    existing = owner.post("/api/projects", json={"title": "기존 사용자 프로젝트"}, headers=bearer(owner_token))
    existing_id = existing.json["data"]["id"]
    client = auth_app.test_client()
    created = register(client)
    uid = created.json["data"]["user"]["id"]
    logged = client.post("/api/auth/login", json={"loginId": "new-user", "password": PASSWORD}, headers={"Origin": ORIGIN})
    assert logged.status_code == 200 and logged.json["data"]["user"]["id"] == uid
    headers = bearer(logged.json["data"]["accessToken"])
    assert client.get("/api/auth/me", headers=headers).json["data"]["id"] == uid
    assert client.get("/api/projects", headers=headers).json["data"] == []
    assert client.get(f"/api/projects/{existing_id}/document", headers=headers).status_code == 404
    assert refresh(client).json["data"]["user"]["id"] == uid
    assert client.post("/api/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": csrf(client)}).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_registration_succeeds_without_redis_but_login_reports_unavailable(auth_app):
    client = auth_app.test_client()
    tokens = auth_app.extensions["token_repository"]
    with patch.object(tokens.client, "eval", side_effect=ConnectionError("private-redis-password")):
        response = register(client)
        assert response.status_code == 201
        logged = client.post("/api/auth/login", json={"loginId": "new-user", "password": PASSWORD}, headers={"Origin": ORIGIN})
        assert logged.status_code == 503 and logged.json["error"]["code"] == "AUTH_UNAVAILABLE"
        assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None
    with auth_app.app_context():
        assert db.session.get(AppUser, response.json["data"]["user"]["id"]) is not None
    assert client.post("/api/auth/login", json={"loginId": "new-user", "password": PASSWORD}, headers={"Origin": ORIGIN}).status_code == 200


def test_registration_minimum_password_does_not_change_existing_short_password_login(auth_app):
    with auth_app.app_context():
        old = db.session.get(AppUser, auth_app.config["TEST_AUTH_USER"])
        old.password_hash = generate_password_hash("x")
        db.session.commit()
    client = auth_app.test_client()
    assert register(client, password="x").status_code == 400
    assert client.post("/api/auth/login", json={"loginId": "auth-a", "password": "x"},
                       headers={"Origin": ORIGIN}).status_code == 200


def test_new_registered_email_requires_password_link_then_google_preserves_uuid(google_app):
    app = google_app.app
    client = app.test_client()
    created = register(client, email=" Owner@GMAIL.com ")
    uid = created.json["data"]["user"]["id"]
    state = start_google(google_app, client)
    denied = callback(client, state)
    assert denied.status_code == 409 and denied.json["error"]["code"] == "GOOGLE_LINK_REQUIRED"
    assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None
    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(UserIdentity)) == 0
    logged = client.post("/api/auth/login", json={"loginId": "new-user", "password": PASSWORD}, headers={"Origin": ORIGIN})
    token = logged.json["data"]["accessToken"]
    state = start_google(google_app, client, link_headers=bearer(token))
    assert callback(client, state).status_code == 303
    assert callback(client, start_google(google_app, client)).status_code == 303
    assert refresh(client).json["data"]["user"]["id"] == uid
    with app.app_context():
        identity = db.session.scalar(select(UserIdentity).where(UserIdentity.user_id == uid))
        assert identity.subject == "GoogleSubject_A"
        original = db.session.get(AppUser, uid)
        assert check_password_hash(original.password_hash, PASSWORD)
    token = refresh(client).json["data"]["accessToken"]
    project = client.post("/api/projects", headers=bearer(token), json={"title": "가입 계정의 기존 자료"})
    assert project.status_code == 201
    project_id = project.json["data"]["id"]
    before = client.get(f"/api/projects/{project_id}/document", headers=bearer(token)).json
    assert register(client, loginId="hijack", email="owner@gmail.com").status_code == 409
    assert client.get(f"/api/projects/{project_id}/document", headers=bearer(token)).json == before
    with app.app_context():
        assert db.session.scalar(select(UserIdentity).where(UserIdentity.user_id == uid)).subject == "GoogleSubject_A"


@pytest.mark.mariadb
@pytest.mark.parametrize("collision", ["loginId", "email"])
def test_mariadb_concurrent_registration_has_one_commit_one_conflict(registration_app, monkeypatch, collision):
    original = auth_service.add_user
    barrier = Barrier(2)
    def concurrent_add(*args, **kwargs):
        barrier.wait(timeout=15)
        return original(*args, **kwargs)
    monkeypatch.setattr(auth_service, "add_user", concurrent_add)
    def attempt(index):
        changes = {"loginId": "same-user" if index == 0 else "SAME-USER"} if collision == "loginId" else {
            "loginId": f"user-{index}", "email": " Same@GMAIL.com " if index == 0 else "same@gmail.COM"}
        return register(registration_app.test_client(), **changes).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results) == [201, 409]
    with registration_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(AppUser)) == 1
