from pathlib import Path
from unittest.mock import patch

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.config import load_config
from app.extensions import db
from app.models import Project


@pytest.fixture
def app():
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {},
    })


def test_migration_and_project_document_roundtrip(app):
    directory = str(Path(__file__).resolve().parents[1] / "migrations")
    with app.app_context():
        upgrade(directory=directory)
        project = Project(title="설계 프로젝트", summary="한글 테스트", data={
            "ideas": [{"id": "idea-1", "title": "MariaDB 연결 🚀"}],
            "tables": [],
        })
        db.session.add(project)
        db.session.commit()
        project_id = project.id
        db.session.remove()
        saved = db.session.get(Project, project_id)
        assert saved.title == "설계 프로젝트"
        assert saved.data["ideas"][0]["title"] == "MariaDB 연결 🚀"
        assert saved.to_dict()["createdAt"].endswith("Z")
        db.session.remove()
        downgrade(directory=directory, revision="base")
        assert "projects" not in inspect(db.engine).get_table_names()


def test_db_check_command(app):
    result = app.test_cli_runner().invoke(args=["db-check"])
    assert result.exit_code == 0
    assert "Database connection OK" in result.output


def test_db_check_failure_does_not_expose_credentials(app):
    with patch.object(db.session, "execute", side_effect=SQLAlchemyError("secret-password")):
        result = app.test_cli_runner().invoke(args=["db-check"])
    assert result.exit_code == 1
    assert "Database connection failed" in result.output
    assert "secret-password" not in result.output


def test_no_api_urls_are_registered(app):
    assert [rule for rule in app.url_map.iter_rules() if rule.endpoint != "static"] == []


def test_database_password_special_characters(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("DB_PASSWORD", "p@ss:/#한글")
    config = load_config()
    assert config["SQLALCHEMY_DATABASE_URI"].password == "p@ss:/#한글"
    assert config["SQLALCHEMY_DATABASE_URI"].drivername == "mysql+pymysql"
