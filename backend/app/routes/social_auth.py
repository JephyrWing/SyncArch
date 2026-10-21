"""Google·이메일 등록의 HTTP/쿠키 경계입니다. 클라이언트 userId는 받지 않습니다."""
import logging
import re
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, redirect, request
from flask_jwt_extended import get_jwt, jwt_required, set_refresh_cookies

from ..auth import actor_from_claims, token_repository
from ..errors import AuthenticationUnavailable, CsrfFailed, GoogleAuthenticationFailed
from ..extensions import db
from ..repositories.auth_state_repository import AuthStateRepository
from ..schemas import social_schema as schema
from ..services import social_auth_service as service
from ..services.auth_service import create_session
from .auth import token_pair

social_auth = Blueprint("social_auth", __name__, url_prefix="/api/auth")
COOKIE = "syncarch_google_binding"
COOKIE_PATH = "/api/auth/google/"


class CallbackLogFilter(logging.Filter):
    def filter(self, record):
        # Werkzeug 개발 서버도 callback query를 기록하지 않습니다. 운영 프록시는 별도 설정합니다.
        def sanitize(value):
            return re.sub(r"(/api/auth/google/callback)\?[^\s\"']*", r"\1?[REDACTED]", value) if isinstance(value, str) else value
        record.msg = sanitize(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(sanitize(value) for value in record.args)
        elif isinstance(record.args, dict):
            record.args = {key: sanitize(value) for key, value in record.args.items()}
        return True


def install_log_filter():
    logger = logging.getLogger("werkzeug")
    if not any(isinstance(item, CallbackLogFilter) for item in logger.filters):
        logger.addFilter(CallbackLogFilter())


def states():
    tokens = token_repository()
    return AuthStateRepository(tokens.client, tokens.prefix)


def provider():
    if not current_app.config["GOOGLE_OAUTH_ENABLED"]:
        raise AuthenticationUnavailable()
    return current_app.extensions["google_provider"]


def current_actor():
    claims = get_jwt()
    actor = actor_from_claims(claims)
    return actor, claims


@social_auth.before_request
def origin():
    if request.method == "POST" and request.headers.get("Origin") not in current_app.config["ALLOWED_ORIGINS"]:
        raise CsrfFailed()


@social_auth.after_request
def privacy(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.endpoint == "social_auth.callback":
        response.delete_cookie(COOKIE, path=COOKIE_PATH, secure=current_app.config["JWT_COOKIE_SECURE"],
                               httponly=True, samesite="Lax")
    return response


@social_auth.get("/options")
def options():
    return jsonify(data={"google": {"enabled": current_app.config["GOOGLE_OAUTH_ENABLED"]},
        "emailVerification": {"enabled": current_app.extensions["verification_mailer"].available}})


def start_response(actor=None, claims=None):
    instance = provider()
    url, binding = service.begin_google(states(), instance, actor=actor,
        session_id=claims["sid"] if claims else None, access_expires=claims["exp"] if claims else None)
    response = jsonify(data={"authorizationUrl": url, "expiresIn": 300})
    response.set_cookie(COOKIE, binding, max_age=300, path=COOKIE_PATH,
        secure=current_app.config["JWT_COOKIE_SECURE"], httponly=True, samesite="Lax")
    return response


@social_auth.post("/google/start")
def start():
    schema.fields(request.get_json(), ())
    return start_response()


@social_auth.post("/google/link/start")
@jwt_required(locations=["headers"])
def link_start():
    value = schema.fields(request.get_json(), ("password",))
    actor, claims = current_actor()
    service.reauthenticate(db.session.session_factory, token_repository(), actor.id, claims["sid"], schema.password(value["password"]))
    return start_response(actor, claims)


@social_auth.get("/google/callback")
def callback():
    instance = provider()
    if any(len(request.args.getlist(key)) > 1 for key in ("state", "code", "error")) or (
            "code" in request.args and "error" in request.args):
        raise GoogleAuthenticationFailed()
    actor, purpose = service.finish_google(db.session.session_factory, token_repository(), states(), instance,
        state=request.args.get("state"), binding=request.cookies.get(COOKIE), code=request.args.get("code"),
        cancelled="error" in request.args)
    location = current_app.config["AUTH_FRONTEND_ORIGIN"] + "/auth/callback"
    if purpose == "link":
        return redirect(location + "?flow=link&linked=true", code=303)
    # identity 커밋은 끝났습니다. 여기서 Redis가 실패해도 이미 확정된 identity는 유지합니다.
    _, refresh, claims = token_pair(actor, str(uuid4()))
    create_session(token_repository(), actor, claims)
    response = redirect(location, code=303)
    from time import time
    set_refresh_cookies(response, refresh, max_age=max(0, claims["exp"] - int(time())))
    return response


@social_auth.post("/email/start")
@jwt_required(locations=["headers"])
def email_start():
    address, password = schema.email_start(request.get_json())
    actor, claims = current_actor()
    return jsonify(data=service.begin_email(db.session.session_factory, token_repository(), states(),
        current_app.extensions["verification_mailer"], user_id=actor.id, session_id=claims["sid"],
        password=password, address=address, secret=current_app.config["JWT_SECRET_KEY"]))


@social_auth.post("/email/verify")
@jwt_required(locations=["headers"])
def email_verify():
    challenge, code = schema.email_verify(request.get_json())
    actor, claims = current_actor()
    return jsonify(data=service.verify_email(db.session.session_factory, token_repository(), states(),
        user_id=actor.id, session_id=claims["sid"], challenge=challenge, code=code,
        secret=current_app.config["JWT_SECRET_KEY"]))
