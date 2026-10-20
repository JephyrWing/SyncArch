from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from flask import abort
from flask_migrate import downgrade, upgrade
from sqlalchemy.exc import IntegrityError, OperationalError

from app.config import load_config
from app.extensions import db
from app.models import AppUser, Project, ProjectMember, ProjectDocument

MIGRATIONS = str(Path(__file__).resolve().parents[1] / "migrations")
PROJECT_ID = "12345678-1234-4123-8123-123456789012"


def test_legacy_migration_preserves_json_and_downgrade(app):
    with app.app_context():
        upgrade(directory=MIGRATIONS, revision="0001")
        legacy = sa.Table("projects", sa.MetaData(), autoload_with=db.engine)
        from datetime import datetime
        now = datetime(2026, 10, 20, 1, 2, 3, 123456)
        original = {"ideas": [{"title": "한글 🚀 'quoted'"}], "legacyField": "preserved"}
        db.session.execute(legacy.insert().values(id=PROJECT_ID, title="이전 프로젝트", summary="보존",
            data=original if isinstance(legacy.c.data.type, sa.JSON) else __import__("json").dumps(original),
            created_at=now, updated_at=now))
        db.session.commit()
        db.session.remove()
        upgrade(directory=MIGRATIONS)
        saved = db.session.get(ProjectDocument, PROJECT_ID)
        assert saved.payload == original
        assert saved.updated_at.microsecond == (123456 if db.engine.dialect.name == "sqlite" else 0)
        project = db.session.get(Project, PROJECT_ID)
        owner = db.session.get(AppUser, project.owner_id)
        assert owner.is_active is False
        assert owner.password_hash == "!disabled"
        assert db.session.get(ProjectMember, (PROJECT_ID, owner.id)).role == "OWNER"
        db.session.remove()
        downgrade(directory=MIGRATIONS, revision="0001")
        old = sa.Table("projects", sa.MetaData(), autoload_with=db.engine)
        row = db.session.execute(sa.select(old)).mappings().one()
        payload = row["data"]
        if isinstance(payload, str):
            import json
            payload = json.loads(payload)
        assert payload == original
        assert row["title"] == "이전 프로젝트"


def test_migration_refuses_truncation_before_ddl(app):
    with app.app_context():
        upgrade(directory=MIGRATIONS, revision="0001")
        from datetime import datetime
        old = sa.Table("projects", sa.MetaData(), autoload_with=db.engine)
        db.session.execute(old.insert().values(id=PROJECT_ID, title="x" * 121, summary="", data="{}"
            if not isinstance(old.c.data.type, sa.JSON) else {}, created_at=datetime.now(), updated_at=datetime.now()))
        db.session.commit()
        db.session.remove()
        with pytest.raises(SystemExit) as failure:
            upgrade(directory=MIGRATIONS)
        assert failure.value.code == 1
        assert set(sa.inspect(db.engine).get_table_names()) == {"projects", "alembic_version"}


def test_legacy_source_json_survives_interrupted_ddl(app):
    with app.app_context():
        upgrade(directory=MIGRATIONS, revision="0001")
        from datetime import datetime
        import json
        original = {"marker": "keep original JSON if DDL fails"}
        old = sa.Table("projects", sa.MetaData(), autoload_with=db.engine)
        db.session.execute(old.insert().values(id=PROJECT_ID, title="Original", summary="",
            data=original if isinstance(old.c.data.type, sa.JSON) else json.dumps(original),
            created_at=datetime.now(), updated_at=datetime.now()))
        db.session.commit()
        db.session.remove()

        def interrupt(connection, cursor, statement, parameters, context, executemany):
            if " ".join(statement.split()).startswith("CREATE TABLE document_mutations"):
                raise RuntimeError("Simulated DDL interruption")

        sa.event.listen(db.engine, "before_cursor_execute", interrupt)
        try:
            with pytest.raises(SystemExit):
                upgrade(directory=MIGRATIONS)
        finally:
            sa.event.remove(db.engine, "before_cursor_execute", interrupt)
        source = sa.Table("projects", sa.MetaData(), autoload_with=db.engine)
        saved = db.session.execute(sa.select(source.c.data)).scalar_one()
        assert (json.loads(saved) if isinstance(saved, str) else saved) == original


def test_foreign_keys_unique_membership_and_role(app):
    with app.app_context():
        upgrade(directory=MIGRATIONS)
        user = AppUser(login_id="owner", display_name="Owner", password_hash="!disabled")
        db.session.add(user)
        db.session.commit()
        user_id = user.id
        project = Project(title="Project", owner_id=user_id)
        db.session.add(project)
        db.session.commit()
        project_id = project.id
        db.session.add(ProjectMember(project_id=project_id, user_id=user_id, role="OWNER"))
        db.session.commit()
        db.session.remove()
        for member in (
            ProjectMember(project_id=project_id, user_id=user_id, role="EDITOR"),
            ProjectMember(project_id=project_id, user_id="00000000-0000-4000-8000-000000000099", role="EDITOR"),
        ):
            db.session.add(member)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()
        db.session.query(ProjectMember).delete()
        db.session.commit()
        db.session.add(ProjectMember(project_id=project_id, user_id=user_id, role="ADMIN"))
        with pytest.raises((IntegrityError, OperationalError)) as rejected:
            db.session.commit()
        if isinstance(rejected.value, OperationalError):
            # MariaDB reports CHECK failures as error 4025, unlike SQLite's IntegrityError.
            assert rejected.value.orig.args[0] == 4025
        db.session.rollback()


@pytest.mark.parametrize("status,code", [(400,"BAD_REQUEST"),(401,"AUTH_REQUIRED"),(403,"FORBIDDEN"),
    (404,"NOT_FOUND"),(409,"VERSION_CONFLICT"),(413,"DOCUMENT_TOO_LARGE"),(422,"VALIDATION_FAILED")])
def test_http_error_contract(app, status, code):
    @app.get("/test-error")
    def test_error():
        abort(status)
    response = app.test_client().get("/test-error")
    assert response.status_code == status
    assert response.json["error"]["code"] == code


def test_method_not_allowed_keeps_allow_header(app):
    @app.get("/test-method")
    def get_only():
        return "ok"
    response = app.test_client().post("/test-method")
    assert response.status_code == 405
    assert response.json["error"]["code"] == "METHOD_NOT_ALLOWED"
    assert "GET" in response.headers["Allow"]


def test_database_error_does_not_leak_sql_or_parameters(app, caplog):
    @app.get("/test-db-error")
    def fail():
        raise OperationalError("secret SQL", {"password": "private-value"}, Exception("db detail"))
    response = app.test_client().get("/test-db-error")
    assert response.status_code == 503
    assert response.json["error"]["code"] == "DB_UNAVAILABLE"
    for secret in ("secret SQL", "private-value", "db detail"):
        assert secret not in response.get_data(as_text=True)
        assert secret not in caplog.text


def test_demo_requires_secrets_and_hosts(monkeypatch):
    monkeypatch.setenv("APP_ENV", "demo")
    with pytest.raises(ValueError, match="SECRET_KEY"):
        load_config()
    monkeypatch.setenv("SECRET_KEY", "test-only-" * 8)
    monkeypatch.setenv("TRUSTED_HOSTS", "demo.example.test")
    monkeypatch.delenv("DB_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="DB_PASSWORD"):
        load_config()
    monkeypatch.setenv("DB_PASSWORD", "test-only")
    config = load_config()
    assert config["SESSION_COOKIE_SECURE"] is True
    assert config["SESSION_COOKIE_HTTPONLY"] is True
    assert config["SESSION_COOKIE_SAMESITE"] == "Lax"
    assert config["TRUSTED_HOSTS"] == ["demo.example.test"]


def test_untrusted_host_rejected(app):
    response = app.test_client().get("/", base_url="https://untrusted.example.test")
    assert response.status_code == 400
    assert response.json["error"]["code"] == "BAD_REQUEST"


def test_demo_refuses_debug_mode(monkeypatch):
    monkeypatch.setenv("APP_ENV", "demo")
    monkeypatch.setenv("FLASK_DEBUG", "1")
    with pytest.raises(ValueError, match="FLASK_DEBUG=0"):
        load_config()


def test_frontend_fallback_excludes_api_and_missing_assets(app, tmp_path):
    (tmp_path / "index.html").write_text("<html>SyncArch test</html>", encoding="utf-8")
    app.config["FRONTEND_DIST"] = tmp_path
    client = app.test_client()
    assert client.get("/").status_code == 200
    assert b"SyncArch test" in client.get("/projects/example").data
    for path in ("/api", "/api/auth/me", "/assets/missing.js"):
        response = client.get(path)
        assert response.status_code == 404
        assert response.json["error"]["code"] == "NOT_FOUND"
