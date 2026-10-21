"""TC-AUTH-01 확장: 실제 Redis·SQL과 서명된 OIDC provider fixture 검증입니다."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import logging
from pathlib import Path
from threading import Barrier, Event
from time import time
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
from uuid import uuid4

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from flask_jwt_extended import decode_token
from flask_migrate import upgrade, downgrade
from google.auth.exceptions import TransportError
import jwt
import pytest
from redis.exceptions import ConnectionError
from sqlalchemy import select, func, text
from sqlalchemy.exc import SQLAlchemyError

from app.errors import (GoogleAuthenticationFailed, GoogleLinkRequired, IdentityConflict,
                        AuthenticationUnavailable)
from app.extensions import db
from app.models import AppUser, UserIdentity, ProjectDocument, utc_now
from app.repositories import identity_repository
from app.repositories.auth_state_repository import AuthStateRepository
from app.routes.social_auth import COOKIE, COOKIE_PATH, CallbackLogFilter
from app.schemas.social_schema import normalize_email
from app.services import social_auth_service as service
from app.services.google_provider import GoogleProvider
from app.social_config import external_config

from test_auth import auth_app, login, bearer, csrf, refresh, PASSWORD, ORIGIN

CLIENT_ID = "fixture.apps.googleusercontent.com"


@pytest.fixture(scope="module")
def signer():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "syncarch-test-only")])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=1)).sign(key, hashes.SHA256()))
    certificate = cert.public_bytes(serialization.Encoding.PEM).decode()

    def encode(nonce="fixture-nonce", **changes):
        claims = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "GoogleSubject_A",
            "iat": int(time()) - 1, "exp": int(time()) + 300, "nonce": nonce,
            "email": "owner@gmail.com", "email_verified": True}
        claims.update(changes)
        return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "fixture-key"})
    return SimpleNamespace(encode=encode, certificate=certificate)


@pytest.fixture
def certificate_transport(monkeypatch, signer):
    def request(*args, **kwargs):
        assert kwargs["timeout"] == 5
        return SimpleNamespace(status=200, data=json.dumps({"fixture-key": signer.certificate}).encode())
    monkeypatch.setattr("app.services.google_provider.Request", lambda **kwargs: request)


@pytest.fixture
def google_app(auth_app, signer, certificate_transport, monkeypatch):
    config = {"GOOGLE_CLIENT_ID": CLIENT_ID, "GOOGLE_CLIENT_SECRET": "fixture-secret",
              "GOOGLE_REDIRECT_URI": ORIGIN + "/api/auth/google/callback"}
    provider = GoogleProvider(config)
    auth_app.config.update(**config, GOOGLE_OAUTH_ENABLED=True, AUTH_FRONTEND_ORIGIN=ORIGIN)
    auth_app.extensions["google_provider"] = provider
    fixture = SimpleNamespace(app=auth_app, profile={}, exchanges=[], fail=None, hook=None)

    def exchange(url, *, data, timeout, allow_redirects):
        assert url == "https://oauth2.googleapis.com/token" and timeout == 5 and allow_redirects is False
        assert data["client_secret"] == "fixture-secret" and data["redirect_uri"] == provider.redirect_uri
        record = fixture.record
        assert data["code_verifier"] == record["verifier"] and data["code"] == "fixture-code"
        fixture.exchanges.append(data["code"])
        if fixture.hook:
            fixture.hook()
        if fixture.fail:
            return SimpleNamespace(status_code=fixture.fail, content=b"provider-failure")
        encoded = signer.encode(record["nonce"], **fixture.profile)
        return SimpleNamespace(status_code=200, content=encoded.encode(), json=lambda: {"id_token": encoded})
    monkeypatch.setattr("app.services.google_provider.requests.post", exchange)
    return fixture


def state_repository(app):
    tokens = app.extensions["token_repository"]
    return AuthStateRepository(tokens.client, tokens.prefix)


def verified_user(app, email="owner@gmail.com"):
    with app.app_context():
        user = db.session.get(AppUser, app.config["TEST_AUTH_USER"])
        user.email, user.email_normalized, user.email_verified_at = *normalize_email(email), utc_now()
        db.session.commit()
        return user.id, user.password_hash


def start_google(fixture, client, *, link_headers=None):
    path = "/api/auth/google/link/start" if link_headers else "/api/auth/google/start"
    response = client.post(path, json={"password": PASSWORD} if link_headers else {},
        headers={"Origin": ORIGIN, **(link_headers or {})})
    assert response.status_code == 200
    params = {key: value[0] for key, value in parse_qs(urlsplit(response.json["data"]["authorizationUrl"]).query).items()}
    states = state_repository(fixture.app)
    fixture.record = json.loads(states.client.get(states.oauth_key(params["state"])))
    assert params["scope"] == "openid email profile" and "access_type" not in params
    assert params["code_challenge_method"] == "S256"
    challenge = base64.urlsafe_b64encode(sha256(fixture.record["verifier"].encode()).digest()).rstrip(b"=").decode()
    assert params["code_challenge"] == challenge
    cookie = client.get_cookie(COOKIE, path=COOKIE_PATH)
    assert cookie.http_only and cookie.same_site == "Lax" and not cookie.secure
    assert 0 < states.client.ttl(states.oauth_key(params["state"])) <= 300
    return params["state"]


def callback(client, state, **values):
    return client.get("/api/auth/google/callback", query_string={"state": state, "code": "fixture-code", **values})


def identity_rows(app):
    with app.app_context():
        return [(row.user_id, row.subject, row.email) for row in db.session.scalars(select(UserIdentity))]


def test_google_authoritative_email_links_preserving_account_and_recovers_with_existing_refresh(google_app):
    fixture, app = google_app, google_app.app
    uid, password_hash = verified_user(app, "Owner@GMAIL.com")
    original = app.test_client()
    original_headers = bearer(login(original).json["data"]["accessToken"])
    project = original.post("/api/projects", json={"title": "Google 연결 전 문서"}, headers=original_headers).json["data"]
    before = original.get(f'/api/projects/{project["id"]}/document', headers=original_headers).json["data"]
    client = app.test_client()
    state = start_google(fixture, client)
    response = callback(client, state)
    assert response.status_code == 303 and response.location == ORIGIN + "/auth/callback"
    assert response.headers["Referrer-Policy"] == "no-referrer" and response.headers["Cache-Control"] == "no-store"
    assert client.get_cookie(COOKIE, path=COOKIE_PATH) is None
    assert "accessToken" not in response.get_data(as_text=True) and "fixture-code" not in response.location
    assert identity_rows(app) == [(uid, "GoogleSubject_A", "owner@gmail.com")]
    recovered = refresh(client)
    assert recovered.status_code == 200 and recovered.json["data"]["user"]["id"] == uid
    headers = bearer(recovered.json["data"]["accessToken"])
    assert client.get(f'/api/projects/{project["id"]}/document', headers=headers).json["data"] == before
    other = app.test_client()
    other_headers = bearer(login(other, loginId="auth-b").json["data"]["accessToken"])
    assert other.get(f'/api/projects/{project["id"]}/document', headers=other_headers).status_code == 404
    with app.app_context():
        assert db.session.get(AppUser, uid).password_hash == password_hash
        assert db.session.scalar(select(func.count()).select_from(AppUser)) == 2


@pytest.mark.parametrize("email,profile,verified,expected", [
    ("owner@workspace.example", {"email": "owner@workspace.example", "hd": "workspace.example"}, True, 303),
    ("owner@outside.example", {"email": "owner@outside.example"}, True, 409),
    ("owner@gmail.com", {"email_verified": False}, True, 409),
    ("owner@gmail.com", {}, False, 409),
    ("other@gmail.com", {}, True, 409),
    ("owner@workspace.example", {"email": "owner@workspace.example", "hd": "another.example"}, True, 409),
])
def test_auto_link_requires_both_verified_app_email_and_google_authority(google_app, email, profile, verified, expected):
    app = google_app.app
    uid, _ = verified_user(app, email)
    if not verified:
        with app.app_context():
            db.session.get(AppUser, uid).email_verified_at = None
            db.session.commit()
    google_app.profile = profile
    client = app.test_client()
    response = callback(client, start_google(google_app, client))
    assert response.status_code == expected
    assert len(identity_rows(app)) == (1 if expected == 303 else 0)
    if expected != 303:
        assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None


def test_existing_subject_has_priority_over_email_and_disabled_account_stays_denied(google_app):
    app = google_app.app
    uid, _ = verified_user(app)
    client = app.test_client()
    assert callback(client, start_google(google_app, client)).status_code == 303
    google_app.profile = {"email": "changed@outside.example", "email_verified": False}
    assert callback(client, start_google(google_app, client)).status_code == 303
    assert identity_rows(app) == [(uid, "GoogleSubject_A", "changed@outside.example")]
    with app.app_context():
        user = db.session.get(AppUser, uid)
        assert user.email_normalized == "owner@gmail.com"
        user.is_active = False
        db.session.commit()
    denied = app.test_client()
    assert callback(denied, start_google(google_app, denied)).status_code == 401
    assert denied.get_cookie("syncarch_refresh", path="/api/auth/") is None


def test_explicit_link_requires_password_and_original_session_without_switching_accounts(google_app):
    app = google_app.app
    client = app.test_client()
    signed_in = login(client)
    headers = bearer(signed_in.json["data"]["accessToken"])
    original = client.get_cookie("syncarch_refresh", path="/api/auth/").value
    bad = client.post("/api/auth/google/link/start", json={"password": "wrong"}, headers={"Origin": ORIGIN, **headers})
    assert bad.status_code == 401 and client.get_cookie(COOKIE, path=COOKIE_PATH) is None
    google_app.profile = {"email": "external@outside.example", "email_verified": False}
    response = callback(client, start_google(google_app, client, link_headers=headers))
    assert response.status_code == 303 and response.location == ORIGIN + "/auth/callback?flow=link&linked=true"
    assert client.get_cookie("syncarch_refresh", path="/api/auth/").value == original
    assert identity_rows(app)[0][0] == app.config["TEST_AUTH_USER"]
    other = app.test_client()
    other_headers = bearer(login(other, loginId="auth-b").json["data"]["accessToken"])
    assert callback(other, start_google(google_app, other, link_headers=other_headers)).status_code == 409
    assert identity_rows(app)[0][0] == app.config["TEST_AUTH_USER"]


@pytest.mark.parametrize("invalidate", ["logout", "disable", "expired"])
def test_link_callback_revalidates_original_actor_after_provider_response(google_app, invalidate):
    app = google_app.app
    client = app.test_client()
    token = login(client).json["data"]["accessToken"]
    state = start_google(google_app, client, link_headers=bearer(token))
    def revoke():
        if invalidate == "logout":
            assert client.post("/api/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": csrf(client)}).status_code == 200
        elif invalidate == "disable":
            with app.app_context():
                db.session.get(AppUser, app.config["TEST_AUTH_USER"]).is_active = False
                db.session.commit()
    if invalidate == "expired":
        states = state_repository(app)
        google_app.record["accessExpires"] = int(time()) - 1
        states.client.set(states.oauth_key(state), json.dumps(google_app.record), ex=300)
    google_app.hook = revoke
    assert callback(client, state).status_code == 401
    assert identity_rows(app) == []


def test_oauth_state_binding_cancellation_expiry_replay_and_duplicate_parameters(google_app):
    app = google_app.app
    verified_user(app)
    client, attacker = app.test_client(), app.test_client()
    state = start_google(google_app, client)
    assert callback(attacker, state).status_code == 401
    assert callback(client, state).status_code == 303
    assert callback(client, state).status_code == 401
    assert len(google_app.exchanges) == 1
    state = start_google(google_app, client)
    assert client.get("/api/auth/google/callback", query_string={"state": state, "error": "access_denied"}).status_code == 401
    assert len(google_app.exchanges) == 1
    state = start_google(google_app, client)
    state_repository(app).client.expire(state_repository(app).oauth_key(state), 0)
    assert callback(client, state).status_code == 401
    state = start_google(google_app, client)
    assert client.get(f"/api/auth/google/callback?state={state}&state={state}&code=fixture-code").status_code == 401


def test_state_consume_is_atomic_and_does_not_consume_on_wrong_browser(google_app):
    client = google_app.app.test_client()
    state = start_google(google_app, client)
    states = state_repository(google_app.app)
    binding = client.get_cookie(COOKIE, path=COOKIE_PATH).value
    with pytest.raises(GoogleAuthenticationFailed):
        states.consume_oauth(state, "another-browser")
    barrier = Barrier(2)
    def consume(_):
        barrier.wait(timeout=10)
        try:
            states.consume_oauth(state, binding)
            return True
        except GoogleAuthenticationFailed:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(consume, range(2))) == [False, True]


def test_multitab_binding_requires_restart_without_account_linking(google_app):
    client = google_app.app.test_client()
    first = start_google(google_app, client)
    second = start_google(google_app, client)
    assert callback(client, first).status_code == 401
    assert callback(client, second).status_code == 401
    assert identity_rows(google_app.app) == []


@pytest.mark.parametrize("failure,expected", [(400, 401), (500, 503), (429, 503)])
def test_provider_failure_consumes_state_without_partial_identity_or_tokens(google_app, failure, expected):
    verified_user(google_app.app)
    google_app.fail = failure
    client = google_app.app.test_client()
    assert callback(client, start_google(google_app, client)).status_code == expected
    assert identity_rows(google_app.app) == []
    assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None


def test_redis_failure_before_and_after_identity_commit_is_fail_closed(google_app):
    app = google_app.app
    verified_user(app)
    client = app.test_client()
    tokens = app.extensions["token_repository"]
    with patch.object(tokens.client, "set", side_effect=ConnectionError("private-redis-secret")):
        assert client.post("/api/auth/google/start", json={}, headers={"Origin": ORIGIN}).status_code == 503
    state = start_google(google_app, client)
    with patch.object(tokens, "create", side_effect=AuthenticationUnavailable()):
        response = callback(client, state)
    assert response.status_code == 503
    assert len(identity_rows(app)) == 1
    assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None
    assert callback(client, start_google(google_app, client)).status_code == 303


def test_identity_database_failure_rolls_back_without_new_session(google_app):
    app = google_app.app
    verified_user(app)
    client = app.test_client()
    state = start_google(google_app, client)
    with patch.object(identity_repository, "insert", side_effect=SQLAlchemyError("fixture-only failure")):
        response = callback(client, state)
    assert response.status_code == 503 and identity_rows(app) == []
    assert client.get_cookie("syncarch_refresh", path="/api/auth/") is None


@pytest.mark.parametrize("changes", [{"aud": "other"}, {"iss": "https://evil.example"}, {"exp": 1},
    {"iat": 9999999999}, {"nonce": "wrong"}, {"azp": "other"}, {"sub": ""}, {"sub": "한글"},
    {"email": ["owner@gmail.com"]}, {"email": "a" * 260 + "@gmail.com"}])
def test_official_signature_and_claim_verification_rejects_invalid_tokens(signer, certificate_transport, changes):
    provider = GoogleProvider({"GOOGLE_CLIENT_ID": CLIENT_ID, "GOOGLE_CLIENT_SECRET": "fixture", "GOOGLE_REDIRECT_URI": "fixture"})
    with pytest.raises(GoogleAuthenticationFailed):
        provider.verify(signer.encode(**changes), "fixture-nonce")


def test_official_verifier_rejects_forged_signature_and_certificate_failure(signer, certificate_transport, monkeypatch):
    provider = GoogleProvider({"GOOGLE_CLIENT_ID": CLIENT_ID, "GOOGLE_CLIENT_SECRET": "fixture", "GOOGLE_REDIRECT_URI": "fixture"})
    encoded = signer.encode()
    header, payload, signature = encoded.split(".")
    forged = header + "." + payload + "." + ("A" if signature[0] != "A" else "B") + signature[1:]
    with pytest.raises(GoogleAuthenticationFailed):
        provider.verify(forged, "fixture-nonce")
    def unavailable(*args, **kwargs):
        raise TransportError("private-certificate-error")
    monkeypatch.setattr("app.services.google_provider.Request", lambda **kwargs: unavailable)
    with pytest.raises(AuthenticationUnavailable):
        provider.verify(encoded, "fixture-nonce")


@pytest.fixture
def email_client(auth_app):
    mailer = SimpleNamespace(available=True, sent=[])
    mailer.send_code = lambda address, code: mailer.sent.append((address, code))
    auth_app.extensions["verification_mailer"] = mailer
    client = auth_app.test_client()
    headers = {"Origin": ORIGIN, **bearer(login(client).json["data"]["accessToken"])}
    return auth_app, client, headers, mailer


def email_start(fixture, address=" Owner@GMAIL.com "):
    app, client, headers, mailer = fixture
    return client.post("/api/auth/email/start", json={"email": address, "password": PASSWORD}, headers=headers)


def email_verify(fixture, challenge, code):
    _, client, headers, _ = fixture
    return client.post("/api/auth/email/verify", json={"challengeId": challenge, "code": code}, headers=headers)


def test_email_verification_stores_only_hash_and_becomes_eligible_for_auto_link(email_client):
    app, client, headers, mailer = email_client
    response = email_start(email_client)
    assert response.status_code == 200
    data = response.json["data"]
    assert set(data) == {"challengeId", "expiresIn"} and data["expiresIn"] == 600
    challenge, code = data["challengeId"], mailer.sent[0][1]
    states = state_repository(app)
    raw = states.client.get(states.email_key(challenge))
    record = json.loads(raw)
    assert code not in raw and record["codeHash"] != code and record["active"] is True
    assert record["normalized"] == "owner@gmail.com" and 0 < states.client.ttl(states.email_key(challenge)) <= 600
    with app.app_context():
        user = db.session.get(AppUser, app.config["TEST_AUTH_USER"])
        assert user.email_verified_at is None
        password_hash = user.password_hash
    verified = email_verify(email_client, challenge, code)
    assert verified.status_code == 200 and verified.json["data"] == {"email": "Owner@GMAIL.com", "verified": True}
    assert email_verify(email_client, challenge, code).status_code == 400
    with app.app_context():
        user = db.session.get(AppUser, app.config["TEST_AUTH_USER"])
        assert user.email_verified_at is not None and user.email_normalized == "owner@gmail.com"
        assert user.password_hash == password_hash
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_email_attempt_cap_expiry_and_resend_throttle(email_client):
    app, _, _, mailer = email_client
    challenge = email_start(email_client).json["data"]["challengeId"]
    code = mailer.sent[0][1]
    assert email_start(email_client).status_code == 429
    wrong = "000000" if code != "000000" else "000001"
    for _ in range(5):
        assert email_verify(email_client, challenge, wrong).status_code == 400
    assert email_verify(email_client, challenge, code).status_code == 400
    states = state_repository(app)
    states.client.delete(states.prefix + "auth:email:cooldown:" + app.config["TEST_AUTH_USER"])
    challenge = email_start(email_client).json["data"]["challengeId"]
    states.client.expire(states.email_key(challenge), 0)
    assert email_verify(email_client, challenge, mailer.sent[-1][1]).status_code == 400


def test_email_challenge_is_bound_to_user_and_original_session(email_client):
    app, client, headers, mailer = email_client
    challenge = email_start(email_client).json["data"]["challengeId"]
    code = mailer.sent[0][1]
    other = app.test_client()
    for login_id in ("auth-b", "auth-a"):
        token = login(other, loginId=login_id).json["data"]["accessToken"]
        response = other.post("/api/auth/email/verify", json={"challengeId": challenge, "code": code},
            headers={"Origin": ORIGIN, **bearer(token)})
        assert response.status_code == 400
    assert email_verify(email_client, challenge, code).status_code == 200


def test_email_smtp_unavailable_failure_and_reauthentication_never_verify(email_client):
    app, client, headers, mailer = email_client
    bad = client.post("/api/auth/email/start", json={"email": "owner@gmail.com", "password": "wrong"}, headers=headers)
    assert bad.status_code == 401 and mailer.sent == []
    mailer.available = False
    assert email_start(email_client).status_code == 503
    assert client.get("/api/auth/options").json["data"]["emailVerification"]["enabled"] is False
    mailer.available = True
    mailer.send_code = lambda *args: (_ for _ in ()).throw(AuthenticationUnavailable())
    assert email_start(email_client).status_code == 503
    states = state_repository(app)
    keys = list(states.client.scan_iter(match=states.prefix + "auth:email:*"))
    assert all(":cooldown:" in key for key in keys)
    with app.app_context():
        assert db.session.get(AppUser, app.config["TEST_AUTH_USER"]).email_verified_at is None


def test_email_duplicate_address_rolls_back_and_pending_challenge_cannot_be_verified(email_client):
    app, _, _, mailer = email_client
    with app.app_context():
        user = db.session.scalar(select(AppUser).where(AppUser.login_id == "auth-b"))
        user.email = user.email_normalized = "owner@gmail.com"
        user.email_verified_at = utc_now()
        db.session.commit()
    challenge = email_start(email_client).json["data"]["challengeId"]
    states = state_repository(app)
    key = states.email_key(challenge)
    record = json.loads(states.client.get(key))
    record["active"] = False
    states.client.set(key, json.dumps(record), ex=600)
    code = mailer.sent[0][1]
    assert email_verify(email_client, challenge, code).status_code == 400
    states.activate_email(challenge)
    assert email_verify(email_client, challenge, code).status_code == 409
    with app.app_context():
        assert db.session.get(AppUser, app.config["TEST_AUTH_USER"]).email_normalized is None


def test_email_verification_requires_active_session_and_rolls_back_database_failure(email_client):
    app, client, headers, mailer = email_client
    challenge = email_start(email_client).json["data"]["challengeId"]
    with patch.object(identity_repository, "set_email", side_effect=SQLAlchemyError("fixture-only")):
        assert email_verify(email_client, challenge, mailer.sent[0][1]).status_code == 503
    assert email_verify(email_client, challenge, mailer.sent[0][1]).status_code == 400
    with app.app_context():
        assert db.session.get(AppUser, app.config["TEST_AUTH_USER"]).email_verified_at is None
    states = state_repository(app)
    states.client.delete(states.prefix + "auth:email:cooldown:" + app.config["TEST_AUTH_USER"])
    challenge = email_start(email_client).json["data"]["challengeId"]
    assert client.post("/api/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-TOKEN": csrf(client)}).status_code == 200
    assert email_verify(email_client, challenge, mailer.sent[-1][1]).status_code == 401


def test_email_challenge_consumption_is_atomic_on_real_redis(email_client):
    app, _, headers, mailer = email_client
    challenge = email_start(email_client).json["data"]["challengeId"]
    with app.app_context():
        claims = decode_token(headers["Authorization"].split(" ", 1)[1])
    states = state_repository(app)
    hashed = service.code_hash(app.config["JWT_SECRET_KEY"], challenge, mailer.sent[0][1])
    barrier = Barrier(2)
    def consume(_):
        barrier.wait(timeout=10)
        try:
            states.consume_email(challenge, claims["sub"], claims["sid"], hashed)
            return True
        except Exception as error:
            from app.errors import EmailVerificationFailed
            if not isinstance(error, EmailVerificationFailed):
                raise
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(consume, range(2))) == [False, True]


@pytest.mark.parametrize("email", ["한글@gmail.com", "a..b@gmail.com", "a@bad_domain.com", "a@-bad.com", "a@localhost", "a\n@gmail.com"])
def test_email_normalization_rejects_invalid_addresses(email):
    with pytest.raises(ValueError):
        normalize_email(email)


def test_email_normalization_does_not_merge_gmail_aliases():
    assert normalize_email(" A.B+tag@GMAIL.com ") == ("A.B+tag@GMAIL.com", "a.b+tag@gmail.com")
    assert normalize_email("ab@gmail.com")[1] != normalize_email("a.b@gmail.com")[1]


def test_social_origin_schema_feature_flags_and_no_secret_logging(app):
    client = app.test_client()
    assert client.get("/api/auth/options").json["data"] == {"google": {"enabled": False}, "emailVerification": {"enabled": False}}
    assert client.post("/api/auth/google/start", json={}, headers={"Origin": ORIGIN}).status_code == 400
    app.config["ALLOWED_ORIGINS"] = [ORIGIN]
    assert client.post("/api/auth/google/start", json={}, headers={"Origin": ORIGIN}).status_code == 503
    assert client.post("/api/auth/google/start", json={"returnTo": "https://evil.example"}, headers={"Origin": ORIGIN}).status_code == 400
    record = logging.LogRecord("werkzeug", logging.INFO, "", 1, '%s - "%s"',
        ("127.0.0.1", "GET /api/auth/google/callback?code=private-code&state=private-state HTTP/1.1"), None)
    CallbackLogFilter().filter(record)
    assert "private-code" not in record.getMessage() and "private-state" not in record.getMessage()


def test_google_configuration_requires_allowed_exact_callback_and_demo_https(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_ENABLED", "true")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "fixture-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/api/auth/google/callback")
    assert external_config("development", ["http://localhost:5173"])["AUTH_FRONTEND_ORIGIN"] == "http://localhost:5173"
    with pytest.raises(ValueError):
        external_config("demo", ["http://localhost:5173"])
    for uri in ("http://evil.example/api/auth/google/callback", "http://localhost:5173/api/auth/google/callback?returnTo=evil"):
        monkeypatch.setenv("GOOGLE_REDIRECT_URI", uri)
        with pytest.raises(ValueError):
            external_config("development", ["http://localhost:5173"])


def test_email_identity_migration_preserves_existing_users_and_projects(app):
    directory = str(Path(__file__).resolve().parents[1] / "migrations")
    uid, pid = str(uuid4()), str(uuid4())
    with app.app_context():
        upgrade(directory=directory, revision="0004")
        db.session.execute(text("INSERT INTO app_users (id,login_id,display_name,password_hash,is_active,created_at) "
            "VALUES (:id,'old-user','old','unchanged-hash',1,CURRENT_TIMESTAMP)"), {"id": uid})
        db.session.execute(text("INSERT INTO projects (id,title,summary,owner_id,created_at,updated_at) "
            "VALUES (:id,'old-project','',:uid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"), {"id": pid, "uid": uid})
        db.session.commit()
        db.session.remove()
        upgrade(directory=directory)
        user = db.session.get(AppUser, uid)
        assert user.password_hash == "unchanged-hash" and user.email_normalized is None and user.email_verified_at is None
        user.email = user.email_normalized = "old@gmail.com"
        user.email_verified_at = utc_now()
        db.session.add(UserIdentity(user_id=uid, provider="google", subject="CaseSensitive_A", email_verified=True))
        db.session.commit()
        db.session.remove()
        downgrade(directory=directory, revision="0004")
        assert db.session.scalar(text("SELECT owner_id FROM projects WHERE id=:id"), {"id": pid}) == uid
        assert db.session.scalar(text("SELECT password_hash FROM app_users WHERE id=:id"), {"id": uid}) == "unchanged-hash"
        db.session.remove()
        upgrade(directory=directory)
        assert db.session.get(AppUser, uid).email is None


@pytest.mark.mariadb
@pytest.mark.parametrize("same_subject", [True, False])
def test_mariadb_concurrent_auto_link_and_case_sensitive_subjects(google_app, same_subject):
    app = google_app.app
    uid, _ = verified_user(app)
    barrier = Barrier(2)
    profiles = [{"sub": "Subject_A", "email": "owner@gmail.com", "email_verified": True},
                {"sub": "Subject_A" if same_subject else "subject_a", "email": "owner@gmail.com", "email_verified": True}]
    def connect(profile):
        with app.app_context():
            barrier.wait(timeout=10)
            try:
                return service.connect_identity(db.session.session_factory, app.extensions["token_repository"], profile).id
            except IdentityConflict:
                return "conflict"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(connect, profiles))
    assert results.count(uid) == (2 if same_subject else 1)
    assert results.count("conflict") == (0 if same_subject else 1)
    assert len(identity_rows(app)) == 1


@pytest.mark.mariadb
def test_mariadb_email_change_during_auto_link_rechecks_after_user_lock(google_app):
    app = google_app.app
    uid, _ = verified_user(app)
    locked, candidate_read, release = Event(), Event(), Event()
    original = identity_repository.user_by_email
    def candidate(session, normalized):
        users = original(session, normalized)
        candidate_read.set()
        return users
    def change_email():
        with app.app_context(), db.session.session_factory.begin() as session:
            user = identity_repository.user_by_id(session, uid)
            locked.set()
            assert release.wait(timeout=15)
            identity_repository.set_email(user, "new@gmail.com", "new@gmail.com", utc_now())
    def connect():
        assert locked.wait(timeout=15)
        with app.app_context():
            try:
                service.connect_identity(db.session.session_factory, app.extensions["token_repository"],
                    {"sub": "email-change-race", "email": "owner@gmail.com", "email_verified": True})
            except GoogleLinkRequired:
                return "denied"
            return "linked"
    with patch.object(identity_repository, "user_by_email", side_effect=candidate), ThreadPoolExecutor(max_workers=2) as pool:
        change = pool.submit(change_email)
        callback_result = pool.submit(connect)
        try:
            assert candidate_read.wait(timeout=15)
        finally:
            release.set()
        change.result(timeout=15)
        assert callback_result.result(timeout=15) == "denied"
    assert identity_rows(app) == []


@pytest.mark.mariadb
@pytest.mark.parametrize("same_subject", [True, False])
def test_mariadb_two_accounts_cannot_claim_same_subject_but_case_is_preserved(google_app, same_subject):
    app = google_app.app
    claims = []
    for login_id in ("auth-a", "auth-b"):
        token = login(app.test_client(), loginId=login_id).json["data"]["accessToken"]
        with app.app_context():
            claims.append(decode_token(token))
    barrier = Barrier(2)
    def connect(index):
        with app.app_context():
            barrier.wait(timeout=10)
            subject = "Subject_A" if same_subject or index == 0 else "subject_a"
            try:
                return service.connect_identity(db.session.session_factory, app.extensions["token_repository"],
                    {"sub": subject, "email_verified": False}, user_id=claims[index]["sub"], session_id=claims[index]["sid"]).id
            except IdentityConflict:
                return "conflict"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(connect, range(2)))
    assert results.count("conflict") == (1 if same_subject else 0)
    assert len(identity_rows(app)) == (1 if same_subject else 2)
