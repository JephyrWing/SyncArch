"""Google 연결·본인 재인증 후 이메일 저장의 업무와 DB 트랜잭션입니다."""
import re
import secrets
from time import time

from sqlalchemy.exc import IntegrityError, OperationalError

from ..errors import (AuthenticationRequired, GoogleAuthenticationFailed,
    GoogleLinkRequired, IdentityConflict)
from ..repositories import identity_repository as identities
from ..repositories.auth_state_repository import digest
from ..schemas.social_schema import normalize_email
from .auth_service import Actor, authenticate, resolve_actor


def _actor(user):
    if user is None or not user.is_active:
        raise AuthenticationRequired()
    return Actor(user.id, user.login_id, user.display_name)


def reauthenticate(session_factory, tokens, user_id, session_id, password):
    actor = resolve_actor(session_factory, tokens, user_id, session_id)
    checked = authenticate(session_factory, actor.login_id, password)
    if checked.id != actor.id:
        raise AuthenticationRequired()
    return actor


def begin_google(states, provider, *, actor=None, session_id=None, access_expires=None):
    state, binding, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(4))
    record = {"purpose": "link" if actor else "login", "nonce": nonce, "verifier": verifier,
        "binding": digest(binding), "expiresAt": int(time()) + 300}
    if actor:
        record.update(userId=actor.id, sessionId=session_id, accessExpires=access_expires)
    states.create_oauth(state, record)
    return provider.authorization_url(state, nonce, verifier), binding


def authoritative_email(profile):
    if profile.get("email_verified") is not True:
        return None
    try:
        _, normalized = normalize_email(profile.get("email"))
    except ValueError:
        return None
    domain = normalized.rsplit("@", 1)[1]
    hd = profile.get("hd")
    if domain in {"gmail.com", "googlemail.com"} or (
            isinstance(hd, str) and hd.isascii() and hd.lower() == domain and re.fullmatch(r"[A-Za-z0-9.-]+", hd)):
        return normalized
    return None


def _conflict(error):
    # 유일성 경쟁 또는 InnoDB 교착은 계정 덮어쓰기 대신 명시적 충돌로 반환합니다.
    if isinstance(error, IntegrityError) or getattr(error.orig, "args", [None])[0] in {1205, 1213}:
        raise IdentityConflict() from None
    raise error


def connect_identity(session_factory, tokens, profile, *, user_id=None, session_id=None):
    try:
        with session_factory.begin() as session:
            known = identities.identity(session, subject=profile["sub"])
            if user_id is None and known:
                candidate_id = known.user_id
            elif user_id is not None:
                candidate_id = user_id
            else:
                normalized = authoritative_email(profile)
                candidates = identities.user_by_email(session, normalized) if normalized else []
                if len(candidates) != 1:
                    raise GoogleLinkRequired()
                candidate_id = candidates[0].id
            user = identities.user_by_id(session, candidate_id)
            actor = _actor(user)
            # 잠금 대기 뒤 최신 identity와 이메일을 다시 확인합니다.
            known = identities.identity(session, subject=profile["sub"], lock=True)
            owned = identities.identity(session, user_id=user.id, lock=True)
            if known and known.user_id != user.id or owned and owned.subject != profile["sub"]:
                raise IdentityConflict()
            if user_id is not None:
                if not tokens.is_active(session_id, user_id):
                    raise AuthenticationRequired()
            elif known is None:
                normalized = authoritative_email(profile)
                if not normalized or user.email_normalized != normalized:
                    raise GoogleLinkRequired()
            if known is None:
                identities.insert(session, user.id, profile)
            else:
                known.email = profile.get("email")
                known.email_verified = profile.get("email_verified") is True
            return actor
    except (IntegrityError, OperationalError) as error:
        _conflict(error)


def finish_google(session_factory, tokens, states, provider, *, state, binding, code=None, cancelled=False):
    if (not isinstance(state, str) or not re.fullmatch(r"[A-Za-z0-9_-]{20,256}", state) or
            not isinstance(binding, str) or not re.fullmatch(r"[A-Za-z0-9_-]{20,256}", binding)):
        raise GoogleAuthenticationFailed()
    record = states.consume_oauth(state, binding)
    if record["expiresAt"] <= int(time()) or cancelled:
        raise GoogleAuthenticationFailed()
    if not isinstance(code, str) or not 1 <= len(code) <= 4096 or "\x00" in code:
        raise GoogleAuthenticationFailed()
    profile = provider.exchange(code, record["verifier"], record["nonce"])
    if record["purpose"] == "link":
        if record["accessExpires"] <= int(time()):
            raise AuthenticationRequired()
        resolve_actor(session_factory, tokens, record["userId"], record["sessionId"])
        actor = connect_identity(session_factory, tokens, profile, user_id=record["userId"], session_id=record["sessionId"])
    else:
        actor = connect_identity(session_factory, tokens, profile)
    return actor, record["purpose"]


def save_email(session_factory, tokens, *, user_id, session_id, password, address):
    reauthenticate(session_factory, tokens, user_id, session_id, password)
    address, normalized = normalize_email(address)
    try:
        with session_factory.begin() as session:
            user = identities.user_by_id(session, user_id)
            _actor(user)
            if not tokens.is_active(session_id, user_id):
                raise AuthenticationRequired()
            identities.set_email(user, address, normalized)
            session.flush()
            return {"email": user.email}
    except (IntegrityError, OperationalError) as error:
        _conflict(error)
