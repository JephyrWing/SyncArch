import click
from flask.cli import with_appcontext
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .extensions import db


@click.command("db-check")
@with_appcontext
def db_check():
    """Check the database connection without exposing an API endpoint."""
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        db.session.rollback()
        raise click.ClickException(
            "Database connection failed. Check backend/.env and MariaDB status."
        ) from error
    click.echo("Database connection OK")


def register_commands(app):
    app.cli.add_command(db_check)
