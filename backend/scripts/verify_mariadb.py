"""Test on an isolated Windows MariaDB 11.4 instance, then verify restart persistence."""
import argparse
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
        tests = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider",
                                "--basetemp", str(work / "pytest")],
                               cwd=BACKEND, env=environment)
        if tests.returncode:
            raise RuntimeError("MariaDB integration tests failed")
        from flask_migrate import upgrade
        from app import create_app
        from app.extensions import db
        from app.models import AppUser, Project, ProjectDocument
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
            db.session.add(ProjectDocument(project_id=project_id, updated_by=user.id,
                                            payload={"schemaVersion": 1, "marker": "재시작 보존 🚀"}))
            db.session.commit()
            db.session.remove()
            db.engine.dispose()
        stop()
        start()
        restarted_app = create_app(config)
        with restarted_app.app_context():
            document = db.session.get(ProjectDocument, project_id)
            assert document.payload["marker"] == "재시작 보존 🚀"
            assert document.version == 1
            db.session.remove()
            db.engine.dispose()
        result = restarted_app.test_cli_runner().invoke(args=["db-check"])
        assert result.exit_code == 0
        print("PASS: DB restart, fresh Flask app, JSON persistence and db-check", flush=True)
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
