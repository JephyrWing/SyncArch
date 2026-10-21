from pathlib import Path
from unittest.mock import patch

from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app.config import load_config
from app.extensions import db
from app.models import AppUser, Project, ProjectDocument, ProjectMember


def test_migration_and_project_document_roundtrip(app):
    directory = str(Path(__file__).resolve().parents[1] / "migrations")
    with app.app_context():
        upgrade(directory=directory)
        user = AppUser(login_id="test-owner", display_name="테스트", password_hash="!disabled")
        db.session.add(user)
        db.session.flush()
        project = Project(title="설계 프로젝트", summary="한글 테스트", owner_id=user.id)
        db.session.add(project)
        db.session.flush()
        document = ProjectDocument(project_id=project.id, updated_by=user.id, payload={
            "schemaVersion": 1, "ideas": [{"id": "idea-1", "title": "MariaDB 연결 🚀"}],
            "features": [], "nodes": [], "connections": [], "tables": [],
        })
        db.session.add(document)
        db.session.add(ProjectMember(project_id=project.id, user_id=user.id, role="OWNER"))
        db.session.commit()
        project_id = project.id
        db.session.remove()
        saved = db.session.get(Project, project_id)
        assert saved.title == "설계 프로젝트"
        saved_document = db.session.get(ProjectDocument, project_id)
        assert saved_document.payload["ideas"][0]["title"] == "MariaDB 연결 🚀"
        assert saved_document.version == 1
        assert set(inspect(db.engine).get_table_names()) == {
            "alembic_version", "app_users", "projects", "project_members",
            "project_documents", "document_mutations", "project_activity", "app_user_identities",
        }
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


def test_foundation_and_auth_apis_are_registered(app):
    assert {rule.rule for rule in app.url_map.iter_rules() if rule.rule.startswith("/api")} >= {
        "/api/health", "/api/auth/login", "/api/auth/me", "/api/auth/csrf", "/api/auth/refresh", "/api/auth/logout"}
    response = app.test_client().get("/api/unknown")
    assert response.status_code == 404
    assert response.json["error"]["code"] == "NOT_FOUND"


def test_database_password_special_characters(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("DB_PASSWORD", "p@ss:/#한글")
    config = load_config()
    assert config["SQLALCHEMY_DATABASE_URI"].password == "p@ss:/#한글"
    assert config["SQLALCHEMY_DATABASE_URI"].drivername == "mysql+pymysql"
