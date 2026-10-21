import os

import click
from flask.cli import with_appcontext
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .extensions import db
from .errors import ApplicationError
from .schemas.seed_schema import parse_seed_passwords
from .services.seed_service import seed_accounts


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


@click.command("seed-accounts")
@with_appcontext
def seed_team_accounts():
    """Explicitly create the five team accounts, preserving existing accounts."""
    try:
        passwords = parse_seed_passwords(os.environ.get("SEED_ACCOUNT_PASSWORDS", ""))
        result = seed_accounts(passwords)
    except ValueError as error:
        raise click.ClickException(str(error)) from None
    except ApplicationError as error:
        raise click.ClickException(error.message) from None
    except SQLAlchemyError:
        raise click.ClickException("Account seed failed. Check migrations and database availability; no accounts were changed.") from None
    click.echo(f"Accounts: created={result['created']}, unchanged={result['unchanged']}")


def register_commands(app):
    app.cli.add_command(db_check)
    app.cli.add_command(seed_team_accounts)
