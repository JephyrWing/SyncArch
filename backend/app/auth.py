"""JWT HTTP 경계와 W15에서 재사용할 접근 토큰 검증입니다."""
from blinker import Namespace
from flask import current_app, jsonify
from flask_jwt_extended import decode_token
from flask_jwt_extended.exceptions import JWTExtendedException, CSRFError
from jwt.exceptions import PyJWTError

from .errors import AuthenticationRequired
from .extensions import db
from .services.auth_service import resolve_actor, session_active

session_revoked = Namespace().signal("auth-session-revoked")


def token_repository():
    return current_app.extensions["token_repository"]


def actor_from_claims(claims):
    return resolve_actor(db.session.session_factory, token_repository(), claims.get("sub"), claims.get("sid"))


def verify_access_token(encoded_token):
    """W15용: 서명·종류·만료·세션·사용자 활성을 검증합니다. 객체 권한은 별도 검사합니다."""
    if not isinstance(encoded_token, str) or len(encoded_token) > 8192:
        raise AuthenticationRequired()
    try:
        claims = decode_token(encoded_token)
    except (PyJWTError, JWTExtendedException, ValueError, TypeError):
        raise AuthenticationRequired() from None
    if claims.get("type") != "access":
        raise AuthenticationRequired()
    return actor_from_claims(claims), {"sessionId": claims["sid"], "expiresAt": claims["exp"]}


def notify_session_revoked(session_id):
    # 세션 폐기는 이미 확정됐으므로 소켓 알림 실패가 인증 복구를 뜻하지 않습니다.
    try:
        session_revoked.send(current_app._get_current_object(), session_id=session_id)
    except Exception:
        current_app.logger.error("Session revocation notification failed")


def register_jwt_callbacks(jwt, app):
    def unauthorized(*args):
        return jsonify(error={"code": "AUTH_REQUIRED", "message": "로그인이 필요하거나 인증 정보가 유효하지 않습니다."}), 401

    jwt.unauthorized_loader(unauthorized)
    jwt.invalid_token_loader(unauthorized)
    jwt.expired_token_loader(unauthorized)
    jwt.revoked_token_loader(unauthorized)

    @jwt.token_in_blocklist_loader
    def session_blocked(header, claims):
        user_id, sid = claims.get("sub"), claims.get("sid")
        return not session_active(token_repository(), user_id, sid)

    # Flask-JWT-Extended의 기본 CSRF 오류도 공통 JSON 오류 계약으로 변환합니다.
    @app.errorhandler(CSRFError)
    def csrf_error(error):
        return jsonify(error={"code": "CSRF_FAILED", "message": "CSRF 정보가 유효하지 않습니다."}), 400
