"""인증 API의 HTTP·쿠키·Origin·JWT 입출력을 처리합니다."""
from datetime import timedelta
from time import time
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (create_access_token, create_refresh_token, decode_token,
    get_jwt, jwt_required, set_refresh_cookies, unset_refresh_cookies)
from werkzeug.exceptions import BadRequest

from ..auth import actor_from_claims, notify_session_revoked, token_repository
from ..errors import AuthenticationRequired, CsrfFailed
from ..extensions import db
from ..schemas.auth_schema import parse_login, parse_registration
from ..services.auth_service import authenticate, create_session, register_user, rotate_session, revoke_session

auth = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return response


@auth.before_request
def validate_origin():
    if request.method == "POST" and request.headers.get("Origin") not in current_app.config["ALLOWED_ORIGINS"]:
        raise CsrfFailed()


def token_pair(actor, sid, expires_at=None):
    remaining = (timedelta(seconds=max(1, expires_at - int(time()))) if expires_at
                 else current_app.config["JWT_REFRESH_TOKEN_EXPIRES"])
    refresh = create_refresh_token(identity=actor.id, additional_claims={"sid": sid}, expires_delta=remaining)
    access = create_access_token(identity=actor.id, additional_claims={"sid": sid},
                                 expires_delta=min(current_app.config["JWT_ACCESS_TOKEN_EXPIRES"], remaining))
    return access, refresh, decode_token(refresh)


def token_response(actor, access, refresh, claims):
    response = jsonify(data={"user": actor.public(), "accessToken": access,
                             "expiresIn": max(0, decode_token(access)["exp"] - int(time()))})
    set_refresh_cookies(response, refresh, max_age=max(0, claims["exp"] - int(time())))
    return response


@auth.post("/register")
def register():
    if not request.is_json:
        raise BadRequest("JSON 요청이 필요합니다.")
    actor = register_user(db.session.session_factory, **parse_registration(request.get_json()))
    return jsonify(data={"user": actor.public()}), 201


@auth.post("/login")
def login():
    if not request.is_json:
        raise BadRequest("JSON 요청이 필요합니다.")
    login_id, password = parse_login(request.get_json())
    actor = authenticate(db.session.session_factory, login_id, password)
    sid = str(uuid4())
    access, refresh, claims = token_pair(actor, sid)
    create_session(token_repository(), actor, claims)
    return token_response(actor, access, refresh, claims)


@auth.get("/me")
@jwt_required(locations=["headers"])
def me():
    return jsonify(data=actor_from_claims(get_jwt()).public())


@auth.get("/csrf")
@jwt_required(refresh=True, locations=["cookies"])
def csrf():
    actor_from_claims(get_jwt())
    return jsonify(data={"csrfToken": get_jwt()["csrf"]})


@auth.post("/refresh")
@jwt_required(refresh=True, locations=["cookies"])
def refresh():
    previous = get_jwt()
    actor = actor_from_claims(previous)
    access, refresh_token, claims = token_pair(actor, previous["sid"], previous["exp"])
    try:
        rotate_session(token_repository(), actor, previous, claims)
    except AuthenticationRequired:
        notify_session_revoked(previous["sid"])
        raise
    return token_response(actor, access, refresh_token, claims)


@auth.post("/logout")
@jwt_required(refresh=True, locations=["cookies"])
def logout():
    claims = get_jwt()
    revoke_session(token_repository(), claims["sid"])
    notify_session_revoked(claims["sid"])
    response = jsonify(data={"loggedOut": True})
    unset_refresh_cookies(response)
    return response
