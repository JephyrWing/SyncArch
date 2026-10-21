"""TC-AUTH-01/03/04: 실제 Redis와 격리 SQL DB를 사용하는 인증 검증."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import os
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from redis import Redis
from redis.exceptions import ConnectionError
from werkzeug.security import generate_password_hash, check_password_hash

from app.auth import session_revoked, verify_access_token
from app.errors import AuthenticationRequired, AuthenticationUnavailable
from app.extensions import db
from app.models import AppUser
from app.repositories.token_repository import TokenRepository

ORIGIN = "http://localhost"
PASSWORD = "test-password-auth-only"


@pytest.fixture
def auth_app(app):
    url = os.getenv("TEST_REDIS_URL")
    if not url:
        raise RuntimeError("실제 Redis 검증에는 TEST_REDIS_URL이 필요합니다. scripts/run_auth_checks.py를 사용하세요.")
    client = Redis.from_url(url, decode_responses=True, socket_connect_timeout=3, socket_timeout=3)
    prefix = f"syncarch:test:{uuid4().hex}:"
    app.extensions["token_repository"] = TokenRepository(client, prefix)
    app.config.update(ALLOWED_ORIGINS=[ORIGIN], JWT_SECRET_KEY="test-jwt-key-" * 6)
    with app.app_context():
        db.create_all()
        user = AppUser(login_id="auth-a", display_name="검증 A", password_hash=generate_password_hash(PASSWORD))
        db.session.add(user)
        db.session.add(AppUser(login_id="auth-b", display_name="검증 B", password_hash=generate_password_hash(PASSWORD)))
        db.session.commit()
        app.config["TEST_AUTH_USER"] = user.id
    try:
        client.ping()
        yield app
    finally:
        # 이번 fixture가 생성한 UUID 영역만 정리합니다. FLUSHDB는 사용하지 않습니다.
        keys = list(client.scan_iter(match=prefix + "*"))
        if keys:
            client.delete(*keys)
        client.close()


def login(client, **extra):
    return client.post("/api/auth/login", json={"loginId": "auth-a", "password": PASSWORD, **extra},
                       headers={"Origin": ORIGIN})


def csrf(client):
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    return response.json["data"]["csrfToken"]


def refresh(client):
    return client.post("/api/auth/refresh", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": csrf(client)})


def bearer(token):
    return {"Authorization": "Bearer " + token}


def test_login_me_refresh_logout_revokes_existing_access(auth_app):
    client = auth_app.test_client()
    response = login(client)
    assert response.status_code == 200
    data = response.json["data"]
    assert data["user"]["displayName"] == "검증 A"
    assert set(data) == {"user", "accessToken", "expiresIn"}
    assert response.headers["Cache-Control"] == "no-store"
    cookie = client.get_cookie("syncarch_refresh", path="/api/auth/")
    assert cookie.http_only and cookie.same_site == "Lax"
    assert cookie.path == "/api/auth/" and not cookie.secure
    assert client.get("/api/auth/me", headers=bearer(data["accessToken"])).status_code == 200
    refreshed = refresh(client)
    assert refreshed.status_code == 200
    assert refreshed.json["data"]["accessToken"] != data["accessToken"]
    revoked = []
    def on_revoke(sender, session_id):
        revoked.append(session_id)
    session_revoked.connect(on_revoke, sender=auth_app)
    try:
        response = client.post("/api/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": csrf(client)})
        assert response.status_code == 200
        assert len(revoked) == 1
    finally:
        session_revoked.disconnect(on_revoke, sender=auth_app)
    assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None
    assert client.get("/api/auth/me", headers=bearer(data["accessToken"])).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(refreshed.json["data"]["accessToken"])).status_code == 401
    assert client.get("/api/auth/csrf").status_code == 401


@pytest.mark.parametrize("payload", [None, [], {}, {"loginId": "auth-a"},
    {"loginId": "auth-a", "password": PASSWORD, "actorId": "auth-b"},
    {"loginId": "auth-a", "password": "x" * 129}, {"loginId": 5, "password": PASSWORD}])
def test_login_rejects_invalid_inputs(auth_app, payload):
    response = auth_app.test_client().post("/api/auth/login", json=payload,
                                           headers={"Origin": ORIGIN})
    assert response.status_code == 400


@pytest.mark.parametrize("origin", [None, "null", "https://evil.example", "http://localhost.evil.example"])
def test_login_origin_denied(auth_app, origin):
    headers = {"Origin": origin} if origin else {}
    response = auth_app.test_client().post("/api/auth/login", json={"loginId": "auth-a", "password": PASSWORD}, headers=headers)
    assert response.status_code == 400
    assert response.json["error"]["code"] == "CSRF_FAILED"


def test_wrong_password_unknown_and_disabled_user_are_indistinguishable(auth_app):
    client = auth_app.test_client()
    responses = [login(client, password="wrong"), login(client, loginId="missing")]
    with auth_app.app_context():
        user = db.session.get(AppUser, auth_app.config["TEST_AUTH_USER"])
        assert user.password_hash != PASSWORD
        assert check_password_hash(user.password_hash, PASSWORD)
        user.is_active = False
        db.session.commit()
    responses.append(login(client))
    assert all(r.status_code == 401 for r in responses)
    assert all(r.json == responses[0].json for r in responses)


def test_refresh_csrf_and_origin_denied_without_rotating(auth_app):
    client = auth_app.test_client()
    assert login(client).status_code == 200
    original = client.get_cookie("syncarch_refresh", path="/api/auth/").value
    for path in ("refresh", "logout"):
        for headers in ({}, {"Origin": ORIGIN}, {"Origin": ORIGIN, "X-CSRF-TOKEN": "wrong"},
                        {"Origin": "https://evil.example", "X-CSRF-TOKEN": csrf(client)}):
            response = client.post("/api/auth/" + path, headers=headers)
            assert response.status_code == 400
            assert response.json["error"]["code"] == "CSRF_FAILED"
            assert client.get_cookie("syncarch_refresh", path="/api/auth/").value == original
    assert refresh(client).status_code == 200


def test_reused_refresh_revokes_whole_family(auth_app):
    client = auth_app.test_client()
    assert login(client).status_code == 200
    old = client.get_cookie("syncarch_refresh", path="/api/auth/").value
    old_csrf = csrf(client)
    result = refresh(client)
    assert result.status_code == 200
    attacker = auth_app.test_client()
    attacker.set_cookie("syncarch_refresh", old, path="/api/auth/")
    response = attacker.post("/api/auth/refresh", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": old_csrf})
    assert response.status_code == 401
    assert client.get("/api/auth/me", headers=bearer(result.json["data"]["accessToken"])).status_code == 401


def test_refresh_compare_replace_is_atomic_on_real_redis(auth_app):
    client = auth_app.test_client()
    assert login(client).status_code == 200
    with auth_app.app_context():
        claims = decode_token(client.get_cookie("syncarch_refresh", path="/api/auth/").value)
    repository = auth_app.extensions["token_repository"]
    barrier = Barrier(2)
    def rotate_once():
        barrier.wait(timeout=10)
        try:
            repository.rotate(claims["sid"], claims["sub"], claims["jti"], str(uuid4()))
            return True
        except AuthenticationRequired:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: rotate_once(), range(2)))
    assert results.count(True) == 1
    assert results.count(False) == 1
    assert repository.is_active(claims["sid"], claims["sub"]) is False


def test_missing_redis_state_and_redis_failure_deny_access(auth_app, caplog):
    client = auth_app.test_client()
    response = login(client)
    assert response.status_code == 200
    token = response.json["data"]["accessToken"]
    repository = auth_app.extensions["token_repository"]
    with patch.object(repository.client, "hmget", side_effect=ConnectionError("private-redis-password")):
        failed = client.get("/api/auth/me", headers=bearer(token))
        assert failed.status_code == 503
        assert failed.json["error"]["code"] == "AUTH_UNAVAILABLE"
        assert "private-redis-password" not in failed.get_data(as_text=True)
        assert "private-redis-password" not in caplog.text
    with auth_app.app_context():
        claims = decode_token(token)
    repository.client.delete(repository._key(claims["sid"]))
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_redis_write_failure_does_not_issue_tokens(auth_app):
    client = auth_app.test_client()
    repository = auth_app.extensions["token_repository"]
    with patch.object(repository.client, "eval", side_effect=ConnectionError("private-redis-password")):
        response = login(client)
        assert response.status_code == 503
        assert "accessToken" not in response.get_data(as_text=True)
        assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None


def test_access_token_rejects_cookie_query_refresh_and_expiration(auth_app):
    client = auth_app.test_client()
    result = login(client)
    assert result.status_code == 200
    token = result.json["data"]["accessToken"]
    refresh_token = client.get_cookie("syncarch_refresh", path="/api/auth/").value
    client.set_cookie("access_token_cookie", token)
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", query_string={"jwt": token}).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(refresh_token)).status_code == 401
    with auth_app.app_context():
        actor, metadata = verify_access_token(token)
        assert actor.id == auth_app.config["TEST_AUTH_USER"]
        assert metadata["expiresAt"] > 0
        expired = create_access_token(actor.id, additional_claims={"sid": metadata["sessionId"]}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(AuthenticationRequired):
            verify_access_token(expired)
        with pytest.raises(AuthenticationRequired):
            verify_access_token(refresh_token)
    assert client.get("/api/auth/me", headers=bearer(expired)).status_code == 401
    assert client.get("/api/auth/me", headers=bearer("invalid-token")).status_code == 401


def test_disabled_user_denies_existing_rest_and_socket_identity(auth_app):
    client = auth_app.test_client()
    result = login(client)
    assert result.status_code == 200
    token = result.json["data"]["accessToken"]
    with auth_app.app_context():
        db.session.get(AppUser, auth_app.config["TEST_AUTH_USER"]).is_active = False
        db.session.commit()
        with pytest.raises(AuthenticationRequired):
            verify_access_token(token)
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_refresh_session_ttl_is_not_extended_and_raw_tokens_not_stored(auth_app):
    client = auth_app.test_client()
    assert login(client).status_code == 200
    old_rt = client.get_cookie("syncarch_refresh", path="/api/auth/").value
    with auth_app.app_context():
        claims = decode_token(old_rt)
    repository = auth_app.extensions["token_repository"]
    key = repository._key(claims["sid"])
    ttl_before = repository.client.ttl(key)
    assert ttl_before > 0
    assert refresh(client).status_code == 200
    ttl_after = repository.client.ttl(key)
    assert 0 < ttl_after <= ttl_before
    state = repository.client.hgetall(key)
    assert set(state) == {"userId", "jtiHash", "status", "expiresAt"}
    assert all(old_rt not in value and claims["jti"] not in value for value in state.values())
    repository.client.expire(key, 0)
    assert client.get("/api/auth/csrf").status_code == 401


def test_secure_cookie_uses_https_independently_of_redis_transport(auth_app):
    auth_app.config.update(JWT_COOKIE_SECURE=True, ALLOWED_ORIGINS=["https://localhost"])
    response = auth_app.test_client().post("/api/auth/login", base_url="https://localhost",
        headers={"Origin": "https://localhost"}, json={"loginId": "auth-a", "password": PASSWORD})
    assert response.status_code == 200
    assert "Secure" in response.headers["Set-Cookie"]
    assert "HttpOnly" in response.headers["Set-Cookie"]
