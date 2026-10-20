import os
import re

import pytest
from sqlalchemy import MetaData, event
from sqlalchemy.engine import make_url

from app import create_app
from app.extensions import db


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    monkeypatch.setattr("app.config.load_dotenv", lambda *args, **kwargs: False)
    monkeypatch.setenv("APP_ENV", "development")
    for name in ("DATABASE_URL", "SECRET_KEY", "TRUSTED_HOSTS", "FLASK_DEBUG"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def app():
    uri = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    url = make_url(uri)
    if url.get_backend_name() != "sqlite" and not re.fullmatch(r"syncarch_test_[a-f0-9]{32}", url.database or ""):
        raise ValueError("Tests require a disposable syncarch_test_<UUID hex> database")
    application = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": uri,
                              "SQLALCHEMY_ENGINE_OPTIONS": {}})
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
