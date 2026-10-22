"""기존 사용자 잠금과 identity/email 저장입니다. 독립 커밋을 하지 않습니다."""
from sqlalchemy import select

from ..models import AppUser, UserIdentity


def user_by_id(session, user_id):
    # 후보 조회가 이미 ORM에 담겼어도 잠금 대기 뒤 현재 DB 값으로 덮어 읽습니다.
    return session.scalar(select(AppUser).where(AppUser.id == user_id).with_for_update()
                          .execution_options(populate_existing=True))


def user_by_email(session, normalized):
    return session.scalars(select(AppUser).where(AppUser.email_normalized == normalized)).all()


def identity(session, *, subject=None, user_id=None, lock=False):
    query = select(UserIdentity).where(UserIdentity.provider == "google")
    query = query.where(UserIdentity.subject == subject) if subject is not None else query.where(UserIdentity.user_id == user_id)
    return session.scalar(query.with_for_update().execution_options(populate_existing=True) if lock else query)


def insert(session, user_id, profile):
    record = UserIdentity(user_id=user_id, provider="google", subject=profile["sub"],
        email=profile.get("email"), email_verified=profile.get("email_verified") is True)
    session.add(record)
    session.flush()
    return record


def set_email(user, address, normalized):
    # 과거 email_verified_at는 보존하며 현재 주소의 인증 여부로 사용하지 않습니다.
    user.email, user.email_normalized = address, normalized
