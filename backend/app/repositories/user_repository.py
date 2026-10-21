from sqlalchemy import select

from ..models import AppUser


def find_by_login_ids(session, login_ids):
    return {user.login_id: user for user in session.scalars(
        select(AppUser).where(AppUser.login_id.in_(login_ids))
    )}


def add_user(session, *, login_id, display_name, password_hash):
    session.add(AppUser(login_id=login_id, display_name=display_name,
                        password_hash=password_hash, is_active=True))
