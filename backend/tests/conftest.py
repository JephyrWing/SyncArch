import os
import re
from pathlib import Path

import pytest
from sqlalchemy import MetaData, event
from sqlalchemy.engine import make_url

from app import create_app
from app.extensions import db


def pytest_addoption(parser):
    parser.addoption("--ci-suite", choices=("unit", "mariadb", "mariadb-full", "browser", "browser-smoke"), default=None,
                     help="CI partition by real browser fixture, without omitting API tests in browser fixtures")


def pytest_collection_modifyitems(config, items):
    suite = config.getoption("--ci-suite")
    if suite:
        selected, deselected = [], []
        for item in items:
            browser = "browser_session" in item.fixturenames
            if suite in ("browser", "browser-smoke"):
                include = browser and (suite == "browser" or "deployment_smoke" in item.keywords)
            else:
                include = not browser and (suite == "mariadb-full" or
                    ("mariadb" in item.keywords) == (suite == "mariadb"))
            (selected if include else deselected).append(item)
        items[:] = selected
        config.hook.pytest_deselected(items=deselected)
    if not os.getenv("TEST_DATABASE_URL", "").startswith(("mysql", "mariadb")):
        selected = [item for item in items if "mariadb" not in item.keywords]
        deselected = [item for item in items if "mariadb" in item.keywords]
        items[:] = selected
        if deselected:
            config.hook.pytest_deselected(items=deselected)


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    monkeypatch.setattr("app.config.load_dotenv", lambda *args, **kwargs: False)
    monkeypatch.setenv("APP_ENV", "development")
    for name in ("DATABASE_URL", "SECRET_KEY", "TRUSTED_HOSTS", "FLASK_DEBUG",
                 "JWT_SECRET_KEY", "REDIS_URL", "ALLOWED_ORIGINS",
                 "JWT_ACCESS_TOKEN_EXPIRES", "JWT_REFRESH_TOKEN_EXPIRES",
                 "GOOGLE_OAUTH_ENABLED", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
                 "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SSL", "SMTP_STARTTLS"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def app():
    uri = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    url = make_url(uri)
    if url.get_backend_name() != "sqlite" and not re.fullmatch(r"syncarch_test_[a-f0-9]{32}", url.database or ""):
        raise ValueError("Tests require a disposable syncarch_test_<UUID hex> database")
    application = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": uri,
                              "SQLALCHEMY_ENGINE_OPTIONS": {}})
    if os.getenv('TEST_FRONTEND_DIST'):
        application.config['FRONTEND_DIST'] = Path(os.environ['TEST_FRONTEND_DIST']).resolve()
    with application.app_context():
        if url.get_backend_name() == "sqlite":
            @event.listens_for(db.engine, "connect")
            def enforce_foreign_keys(connection, record):
                connection.execute("PRAGMA foreign_keys=ON")
        else:
            metadata = MetaData()
            metadata.reflect(bind=db.engine)
            metadata.drop_all(bind=db.engine)
    yield application
    with application.app_context():
        db.session.remove()
        db.engine.dispose()
