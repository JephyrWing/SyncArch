import json
from pathlib import Path
from unittest.mock import patch

import pytest
from flask_migrate import upgrade
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models import AppUser
from app.schemas.seed_schema import ACCOUNTS

MIGRATIONS = str(Path(__file__).resolve().parents[1] / "migrations")


def credentials():
    return {key: "test-only-credential-" + str(i) for i, key in enumerate(ACCOUNTS)}


def test_health_returns_only_public_database_status(app):
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.json == {"data": {"status": "ok", "database": "ok"}}


def test_health_database_failure_is_503_without_details(app, caplog):
    with patch("app.services.health_service.check_connection", side_effect=OperationalError(
        "secret SQL", {"password": "private-value"}, Exception("db detail")
    )):
        response = app.test_client().get("/api/health")
    assert response.status_code == 503
    assert response.json["error"]["code"] == "DB_UNAVAILABLE"
    for secret in ("secret SQL", "private-value", "db detail"):
        assert secret not in response.get_data(as_text=True) + caplog.text
    assert app.test_client().get("/api/health").status_code == 200


def test_seed_hashes_passwords_and_preserves_existing_accounts(app, monkeypatch):
    with app.app_context():
        upgrade(directory=MIGRATIONS)
    passwords = credentials()
    monkeypatch.setenv("SEED_ACCOUNT_PASSWORDS", json.dumps(passwords))
    runner = app.test_cli_runner()
    first = runner.invoke(args=["seed-accounts"])
    assert first.exit_code == 0
    assert "created=5, unchanged=0" in first.output
    with app.app_context():
        users = list(db.session.scalars(select(AppUser)))
        before = {u.login_id: (u.id, u.password_hash) for u in users}
        assert len(users) == 5
        for user in users:
            assert user.display_name == ACCOUNTS[user.login_id]
            assert user.is_active is True
            assert user.password_hash != passwords[user.login_id]
            assert check_password_hash(user.password_hash, passwords[user.login_id])
    monkeypatch.setenv("SEED_ACCOUNT_PASSWORDS", json.dumps({k: v + "-changed" for k, v in passwords.items()}))
    second = runner.invoke(args=["seed-accounts"])
    assert second.exit_code == 0
    assert "created=0, unchanged=5" in second.output
    with app.app_context():
        assert {u.login_id: (u.id, u.password_hash) for u in db.session.scalars(select(AppUser))} == before
    assert all(password not in first.output + second.output for password in passwords.values())


@pytest.mark.parametrize("raw", ["", "not JSON", "[]", "{}", '{"choi_jinwoo":"secret", "choi_jinwoo":"other"}',
    json.dumps({k: "same-password-for-all" for k in ACCOUNTS}),
    json.dumps({k: "short" for k in ACCOUNTS})])
def test_seed_rejects_invalid_credentials_before_writing(app, monkeypatch, raw):
    monkeypatch.setenv("SEED_ACCOUNT_PASSWORDS", raw)
    with patch("app.commands.seed_accounts") as seed:
        result = app.test_cli_runner().invoke(args=["seed-accounts"])
    assert result.exit_code == 1
    assert "SEED_ACCOUNT_PASSWORDS requires" in result.output
    assert "secret" not in result.output
    seed.assert_not_called()


def test_seed_rolls_back_all_accounts_on_failure(app, monkeypatch):
    with app.app_context():
        upgrade(directory=MIGRATIONS)
    monkeypatch.setenv("SEED_ACCOUNT_PASSWORDS", json.dumps(credentials()))
    from app.repositories.user_repository import add_user
    calls = 0

    def fail_after_first(session, **values):
        nonlocal calls
        calls += 1
        add_user(session, **values)
        session.flush()
        if calls == 2:
            raise OperationalError("secret SQL", {}, Exception("private-value"))

    with patch("app.services.seed_service.add_user", side_effect=fail_after_first):
        result = app.test_cli_runner().invoke(args=["seed-accounts"])
    assert result.exit_code == 1
    assert "no accounts were changed" in result.output
    assert "private-value" not in result.output
    with app.app_context():
        assert list(db.session.scalars(select(AppUser))) == []


def test_seed_refuses_to_reactivate_existing_account(app, monkeypatch):
    with app.app_context():
        upgrade(directory=MIGRATIONS)
        db.session.add(AppUser(login_id="choi_jinwoo", display_name="최진우", password_hash="!disabled", is_active=False))
        db.session.commit()
    monkeypatch.setenv("SEED_ACCOUNT_PASSWORDS", json.dumps(credentials()))
    result = app.test_cli_runner().invoke(args=["seed-accounts"])
    assert result.exit_code == 1
    with app.app_context():
        users = list(db.session.scalars(select(AppUser)))
        assert len(users) == 1
        assert users[0].is_active is False
        assert users[0].password_hash == "!disabled"
