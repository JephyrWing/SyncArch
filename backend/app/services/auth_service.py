"""HTTP/쿠키와 독립적인 계정 확인·세션 유효성 검사입니다."""
from dataclasses import dataclass

from werkzeug.security import check_password_hash, generate_password_hash

from ..errors import AuthenticationRequired
from ..repositories.user_repository import find_by_id, find_by_login_id

_DUMMY_HASH = generate_password_hash("not-a-real-account-password")


@dataclass(frozen=True)
class Actor:
    id: str
    login_id: str
    display_name: str

    def public(self):
        return {"id": self.id, "loginId": self.login_id, "displayName": self.display_name}


def authenticate(session_factory, login_id, password):
    with session_factory() as session:
        user = find_by_login_id(session, login_id)
        valid = check_password_hash(user.password_hash if user else _DUMMY_HASH, password)
        if not user or not valid or not user.is_active:
            raise AuthenticationRequired()
        return Actor(user.id, user.login_id, user.display_name)


def resolve_actor(session_factory, tokens, user_id, session_id):
    if not session_active(tokens, user_id, session_id):
        raise AuthenticationRequired()
    with session_factory() as session:
        user = find_by_id(session, user_id)
        if not user or not user.is_active:
            raise AuthenticationRequired()
        return Actor(user.id, user.login_id, user.display_name)


def session_active(tokens, user_id, session_id):
    return (isinstance(user_id, str) and isinstance(session_id, str)
            and tokens.is_active(session_id, user_id))


def create_session(tokens, actor, claims):
    tokens.create(claims["sid"], actor.id, claims["jti"], claims["exp"])


def rotate_session(tokens, actor, previous, replacement):
    tokens.rotate(previous["sid"], actor.id, previous["jti"], replacement["jti"])


def revoke_session(tokens, session_id):
    tokens.revoke(session_id)
