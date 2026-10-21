from sqlalchemy import text


def check_connection(session):
    return session.execute(text("SELECT 1")).scalar_one()
