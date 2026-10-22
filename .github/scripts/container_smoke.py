"""Test the actual two release images against disposable MariaDB and Redis."""
import json
import os
from pathlib import Path
import secrets
import subprocess
from uuid import uuid4

from frontend_artifact import inventory
from run_backend import admin
from smoke import smoke


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def main():
    assert os.getenv('CI') == 'true', 'Only run with disposable CI services'
    sha = os.environ['GITHUB_SHA']
    name = 'syncarch_test_' + uuid4().hex
    containers = []
    keys = {'SECRET_KEY': secrets.token_hex(32), 'JWT_SECRET_KEY': secrets.token_hex(32)}
    password = secrets.token_urlsafe(24)
    try:
        with admin() as connection, connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4')
        environment = {'APP_ENV': 'development', 'FLASK_DEBUG': '0', **keys,
            'DB_HOST': '127.0.0.1', 'DB_PORT': '3306', 'DB_USER': 'root',
            'DB_PASSWORD': 'ci-only-mariadb', 'DB_NAME': name,
            'REDIS_URL': 'redis://default:ci-only-redis@127.0.0.1:6379/0',
            'ALLOWED_ORIGINS': 'http://127.0.0.1:8080', 'GOOGLE_OAUTH_ENABLED': 'false'}
        command = ['run', '-d', '--network', 'host']
        for key, value in environment.items():
            command += ['-e', f'{key}={value}']
        containers.append(docker(*command, 'syncarch-backend:' + sha))
        containers.append(docker('run', '-d', '--network', 'host', '-e',
                                 'API_UPSTREAM=http://127.0.0.1:5000', 'syncarch-frontend:' + sha))
        # A fresh CI-only account, through the real registration API, never a production seed.
        from urllib.request import Request, urlopen
        import time
        for attempt in range(60):
            try:
                with urlopen('http://127.0.0.1:8080/api/health', timeout=5) as response:
                    assert response.status == 200
                break
            except Exception:
                if attempt == 59:
                    raise RuntimeError('Release containers not ready') from None
                time.sleep(2)
        request = Request('http://127.0.0.1:8080/api/auth/register', method='POST',
            data=json.dumps({'loginId': 'ci-smoke', 'displayName': 'CI smoke', 'password': password}).encode(),
            headers={'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:8080'})
        with urlopen(request, timeout=20) as response:
            assert response.status == 201
        smoke('http://127.0.0.1:8080', sha, 'ci-smoke', password, timeout=30)
        manifest = {'revision': sha, 'images': {}}
        for service in ('frontend', 'backend'):
            image = 'syncarch-' + service + ':' + sha
            details = json.loads(docker('image', 'inspect', image))[0]
            assert details['Config']['Labels']['org.opencontainers.image.revision'] == sha
            manifest['images'][service] = {'name': image, 'id': details['Id']}
        # The Git-source Dockerfile rebuild must produce the frontend files CI tested.
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            subprocess.run(['docker', 'cp', containers[1] + ':/usr/share/nginx/html/.', folder], check=True)
            expected = json.loads(Path('.local/frontend-manifest.json').read_text(encoding='utf-8'))
            actual = inventory(Path(folder))
            assert all(actual.get(path) == checksum for path, checksum in expected['files'].items()), 'Source rebuild differs from tested frontend'
        manifest['delivery'] = 'git-source-rebuild'
        Path('.local/release-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    finally:
        for container in reversed(containers):
            subprocess.run(['docker', 'rm', '-f', container], check=True, stdout=subprocess.DEVNULL)
        with admin() as connection, connection.cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS `{name}`')


if __name__ == '__main__':
    main()
