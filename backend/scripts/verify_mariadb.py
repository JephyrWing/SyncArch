"""Test on an isolated Windows MariaDB 11.4 instance, then verify restart persistence."""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

import pymysql
from sqlalchemy.engine import URL

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin-dir", type=Path, default=Path(r"C:\Program Files\MariaDB 11.4\bin"))
    parser.add_argument("--junitxml", type=Path, help="Retain the pytest report outside the temporary DB directory")
    args = parser.parse_args()
    server = args.bin_dir / "mariadbd.exe"
    install_db = args.bin_dir / "mariadb-install-db.exe"
    if not server.is_file() or not install_db.is_file():
        parser.error("MariaDB 11.4 Windows binaries not found")
    if "11.4." not in subprocess.check_output([str(server), "--version"], text=True):
        parser.error("MariaDB 11.4 is required")
    local = (BACKEND.parent / ".local").resolve()
    local.mkdir(exist_ok=True)
    temporary = tempfile.TemporaryDirectory(prefix="mariadb-verify-", dir=local)
    work = Path(temporary.name).resolve()
    # TemporaryDirectory recursively removes only this checked test directory.
    if work.parent != local or not work.name.startswith("mariadb-verify-"):
        raise RuntimeError("Unexpected test directory")
    password = secrets.token_hex(24)
    database = "syncarch_test_" + uuid4().hex
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    data = work / "data"
    log = (work / "server.log").open("w", encoding="utf-8")
    process = None
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

    def connect():
        return pymysql.connect(host="127.0.0.1", port=port, user="root", password=password,
                               charset="utf8mb4", autocommit=True, connect_timeout=2)

    def start():
        nonlocal process
        process = subprocess.Popen([str(server), f"--defaults-file={work / 'my.ini'}", "--console"],
                                   stdout=log, stderr=log, creationflags=flags)
        for _ in range(150):
            if process.poll() is not None:
                raise RuntimeError("Isolated MariaDB failed to start")
            try:
                with connect():
                    return
            except pymysql.MySQLError:
                time.sleep(0.1)
        raise RuntimeError("Isolated MariaDB startup timed out")

    def stop():
        if process is None or process.poll() is not None:
            return
        try:
            with connect() as connection, connection.cursor() as cursor:
                cursor.execute("SHUTDOWN")
            process.wait(timeout=30)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)

    try:
        # Never include this bootstrap command/password in exception output.
        initialized = subprocess.run([str(install_db), f"--datadir={data}", f"--password={password}",
            f"--port={port}", "--silent"], stdout=log, stderr=log, creationflags=flags)
        if initialized.returncode:
            raise RuntimeError("Isolated MariaDB initialization failed")
        (work / "my.ini").write_text(
            f"[mysqld]\nbasedir={args.bin_dir.parent.as_posix()}\ndatadir={data.as_posix()}\n"
            f"port={port}\nbind-address=127.0.0.1\ncharacter-set-server=utf8mb4\n"
            "collation-server=utf8mb4_unicode_ci\n", encoding="utf-8")
        start()
        with connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()[0]
            assert version.startswith("11.4.")
            print("MariaDB integration target:", version, flush=True)
            cursor.execute(f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        uri = URL.create("mysql+pymysql", username="root", password=password, host="127.0.0.1",
                         port=port, database=database, query={"charset": "utf8mb4"})
        environment = os.environ.copy()
        environment["TEST_DATABASE_URL"] = uri.render_as_string(hide_password=False)
        test_command = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider",
                        "--basetemp", str(work / "pytest")]
        if args.junitxml:
            test_command.extend(["--junitxml", str(args.junitxml.resolve())])
        tests = subprocess.run(test_command,
                               cwd=BACKEND, env=environment)
        if tests.returncode:
            raise RuntimeError("MariaDB integration tests failed")
        # The last pytest fixture may intentionally leave disabled/conflicting users.
        # Only reset this generated disposable DB, never an application database.
        with connect() as connection, connection.cursor() as cursor:
            cursor.execute(f"DROP DATABASE `{database}`")
            cursor.execute(f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        from flask_migrate import upgrade
        from app import create_app
        from app.extensions import db
        from app.models import AppUser, Project, ProjectDocument
        from app.schemas.seed_schema import ACCOUNTS
        config = {"TESTING": True, "SQLALCHEMY_DATABASE_URI": uri}
        app = create_app(config)
        with app.app_context():
            upgrade(directory=str(BACKEND / "migrations"))
            from alembic.autogenerate import compare_metadata
            from alembic.migration import MigrationContext
            with db.engine.connect() as connection:
                differences = compare_metadata(MigrationContext.configure(connection), db.metadata)
                if differences:
                    raise RuntimeError(f"Migration/model schema drift: {differences}")
            user = AppUser(login_id="restart-check", display_name="재시작 검증", password_hash="!disabled")
            db.session.add(user)
            db.session.flush()
            project = Project(title="재시작 확인", owner_id=user.id)
            db.session.add(project)
            db.session.flush()
            project_id = project.id
            restart_actor_id = user.id
            db.session.add(ProjectDocument(project_id=project_id, updated_by=user.id,
                                            payload={"schemaVersion": 1, "marker": "재시작 보존 🚀"}))
            db.session.commit()
            db.session.remove()
            db.engine.dispose()
        # Explicit bootstrap only: passwords remain in memory and out of output.
        os.environ["SEED_ACCOUNT_PASSWORDS"] = json.dumps({key: secrets.token_urlsafe(24) for key in ACCOUNTS})
        try:
            seeded = app.test_cli_runner().invoke(args=["seed-accounts"])
        finally:
            os.environ.pop("SEED_ACCOUNT_PASSWORDS", None)
        assert seeded.exit_code == 0
        # 실제 W05 저장 결과·멱등 응답·활동 이력을 DB와 Flask 재시작 뒤 대조합니다.
        from app.schemas.document_schema import save_input
        from app.services import project_service, document_service
        with app.app_context():
            saved_project = project_service.create_project(db.session.session_factory, restart_actor_id,
                {"title": "W05 재시작 전"})
            idea_id, feature_id, client_id, server_id = (str(uuid4()) for _ in range(4))
            restart_request = {"baseVersion": 1, "mutationId": str(uuid4()),
                "project": {"title": "W05 저장 보존", "summary": "한글 🚀"},
                "payload": {"schemaVersion": 2, "ideas": [{"id": idea_id, "title": "영구 기록",
                    "category": "problems_goals", "comments": [{"id": str(uuid4()), "text": "재시작 뒤에도 동일"}]}],
                    "features": [{"id": feature_id, "name": "재시작 기능", "status": "COMPLETED", "relatedStoryId": idea_id}],
                    "nodes": [{"id": client_id, "name": "화면", "category": "Client", "x": 20, "y": 30},
                              {"id": server_id, "name": "서버", "category": "Service", "x": 200, "y": 300}],
                    "connections": [{"id": str(uuid4()), "sourceId": client_id, "targetId": server_id, "protocol": "REST", "description": "영구 연결"}],
                    "tables": [{"id": str(uuid4()), "name": "restart_check", "relatedFeatureIds": [feature_id],
                        "x": 40, "y": 60, "columns": [{"id": str(uuid4()), "name": "id", "dataType": "INT", "isPrimaryKey": True}]}]}}
            restart_fields, restart_conversions = save_input(restart_request)
            restart_result = document_service.save_document(db.session.session_factory, restart_actor_id,
                saved_project["id"], restart_fields, restart_conversions)
        with app.app_context():
            from sqlalchemy import select
            accounts_before = {user.login_id: (user.id, user.password_hash) for user in
                               db.session.scalars(select(AppUser).where(AppUser.login_id.in_(ACCOUNTS)))}
            assert len(accounts_before) == 5
            db.session.remove()
            db.engine.dispose()
        stop()
        start()
        restarted_app = create_app(config)
        with restarted_app.app_context():
            document = db.session.get(ProjectDocument, project_id)
            assert document.payload["marker"] == "재시작 보존 🚀"
            assert document.version == 1
            assert {user.login_id: (user.id, user.password_hash) for user in
                    db.session.scalars(select(AppUser).where(AppUser.login_id.in_(ACCOUNTS)))} == accounts_before
            restored = project_service.get_document(db.session.session_factory, restart_actor_id, saved_project["id"])
            assert restored["payload"] == restart_result["payload"] and restored["version"] == 2
            assert restored["project"]["title"] == "W05 저장 보존"
            replay = document_service.save_document(db.session.session_factory, restart_actor_id,
                saved_project["id"], restart_fields, restart_conversions)
            assert replay == {**restart_result, "replayed": True}
            dashboard = document_service.get_dashboard(db.session.session_factory, restart_actor_id, saved_project["id"])
            assert dashboard["version"] == 2 and dashboard["recentActivity"][0]["eventId"] == restart_result["eventId"]
            assert dashboard["progress"] == 100 and dashboard["counts"]["tables"] == 1
            db.session.remove()
            db.engine.dispose()
        result = restarted_app.test_cli_runner().invoke(args=["db-check"])
        assert result.exit_code == 0
        assert restarted_app.test_client().get("/api/health").json == {"data": {"status": "ok", "database": "ok"}}
        print("PASS: DB restart, fresh Flask app, JSON/account/hash persistence, health and db-check", flush=True)
        print("PASS: W05 committed document/metadata/version/mutation result/activity survive DB and app restart", flush=True)
    finally:
        try:
            if process is not None and process.poll() is None:
                with connect() as connection, connection.cursor() as cursor:
                    cursor.execute(f"DROP DATABASE IF EXISTS `{database}`")
        finally:
            stop()
            log.close()
            temporary.cleanup()


if __name__ == "__main__":
    main()
