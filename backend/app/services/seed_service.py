from werkzeug.security import generate_password_hash

from ..errors import SeedConflict
from ..extensions import db
from ..repositories.user_repository import add_user, find_by_login_ids
from ..schemas.seed_schema import ACCOUNTS


def seed_accounts(passwords):
    """Create missing team accounts atomically; never reset an existing account."""
    # Own the session and transaction, independently of any request autobegin.
    with db.session.session_factory.begin() as session:
        existing = find_by_login_ids(session, ACCOUNTS)
        for login_id, user in existing.items():
            if user.display_name != ACCOUNTS[login_id] or not user.is_active:
                raise SeedConflict()
        for login_id, display_name in ACCOUNTS.items():
            if login_id not in existing:
                add_user(session, login_id=login_id, display_name=display_name,
                         password_hash=generate_password_hash(passwords[login_id]))
    return {"created": len(ACCOUNTS) - len(existing), "unchanged": len(existing)}
