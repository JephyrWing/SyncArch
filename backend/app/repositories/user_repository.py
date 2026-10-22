from sqlalchemy import select

from ..models import AppUser


def find_by_login_id(session, login_id):
    return session.scalar(select(AppUser).where(AppUser.login_id == login_id))


def find_by_id(session, user_id):
    return session.get(AppUser, user_id)


def find_by_login_ids(session, login_ids):
    return {user.login_id: user for user in session.scalars(
        select(AppUser).where(AppUser.login_id.in_(login_ids))
    )}


def add_user(session, *, login_id, display_name, password_hash, email=None, email_normalized=None):
    user = AppUser(login_id=login_id, display_name=display_name,
                   password_hash=password_hash, is_active=True,
                   email=email, email_normalized=email_normalized)
    session.add(user)
    return user
