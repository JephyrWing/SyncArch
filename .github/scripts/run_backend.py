"""Run CI against local disposable services, never an application database."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from check_junit import validate


def admin():
    import pymysql
    port = int(os.getenv('CI_DB_PORT', '3306'))
    assert port in (3306, 3307), 'Only disposable CI service ports are supported'
    return pymysql.connect(host='127.0.0.1', port=port, user='root',
                           password='ci-only-mariadb', autocommit=True, charset='utf8mb4')


def migration_persistence(service):
    """A new UUID DB survives an actual service restart; schema matches models."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from flask_migrate import upgrade
    from app import create_app
    from app.extensions import db
    from app.models import AppUser
    name = 'syncarch_test_' + uuid4().hex
    app = None
    try:
        with admin() as connection, connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4')
        app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI':
            f'mysql+pymysql://root:ci-only-mariadb@127.0.0.1:{os.getenv("CI_DB_PORT", "3306")}/{name}?charset=utf8mb4'})
        with app.app_context():
            upgrade(directory=str(ROOT / 'backend/migrations'))
            with db.engine.connect() as connection:
                assert not compare_metadata(MigrationContext.configure(connection), db.metadata), 'Migration/model drift'
            user = AppUser(login_id='ci-persistence', display_name='CI persistence', password_hash='!disabled')
            db.session.add(user)
            db.session.commit()
            user_id = user.id
            db.session.remove()
            db.engine.dispose()
        subprocess.run(['docker', 'restart', service], check=True, stdout=subprocess.DEVNULL)
        for attempt in range(60):
            try:
                with admin():
                    break
            except Exception:
                if attempt == 59:
                    raise RuntimeError('CI MariaDB did not return after restart') from None
                time.sleep(1)
        with app.app_context():
            assert db.session.get(AppUser, user_id).login_id == 'ci-persistence'
        print('PASS: forward migrations, zero schema drift, DB service restart persistence')
    finally:
        if app:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
        with admin() as connection, connection.cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS `{name}`')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('suite', choices=('unit', 'mariadb', 'browser'))
    parser.add_argument('--restart-service')
    args = parser.parse_args()
    if os.getenv('CI') != 'true':
        raise SystemExit('This runner is exclusively for disposable CI services')
    local = ROOT / '.local'
    local.mkdir(exist_ok=True)
    environment = {**os.environ, 'APP_ENV': 'development', 'GOOGLE_OAUTH_ENABLED': 'false',
                   'TEST_REDIS_URL': 'redis://default:ci-only-redis@127.0.0.1:6379/0'}
    name = None
    try:
        if args.suite == 'unit':
            environment['TEST_DATABASE_URL'] = 'sqlite:///:memory:'
        else:
            name = 'syncarch_test_' + uuid4().hex
            with admin() as connection, connection.cursor() as cursor:
                cursor.execute('SELECT VERSION()')
                version = cursor.fetchone()[0]
                print('Actual integration database:', version, flush=True)
                (local / 'database-version.json').write_text(json.dumps({'version': version}), encoding='utf-8')
                cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
            environment['TEST_DATABASE_URL'] = f'mysql+pymysql://root:ci-only-mariadb@127.0.0.1:{os.getenv("CI_DB_PORT", "3306")}/{name}?charset=utf8mb4'
        report = local / f'{args.suite}.xml'
        subprocess.run([sys.executable, '-m', 'pytest', '-q', '--ci-suite', args.suite,
                        '--junitxml', str(report)], cwd=ROOT / 'backend', env=environment, check=True)
        validate(report)
        if args.restart_service:
            migration_persistence(args.restart_service)
    finally:
        if name:
            with admin() as connection, connection.cursor() as cursor:
                cursor.execute(f'DROP DATABASE IF EXISTS `{name}`')


if __name__ == '__main__':
    main()
