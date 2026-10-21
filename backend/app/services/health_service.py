from ..extensions import db
from ..repositories.health_repository import check_connection


def check_health():
    # A dedicated read-only session releases its connection on both paths.
    with db.session.session_factory() as session:
        check_connection(session)
    return {"status": "ok", "database": "ok"}
