"""Check the deployed SHA and exercise real authenticated read/save/ETag/logout."""
from copy import deepcopy
from http.cookiejar import CookieJar
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler, Request
from uuid import uuid4


class NoRedirect(HTTPRedirectHandler):
    # Never forward account credentials or bearer tokens to a redirected host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def smoke(origin, sha, login_id, password, timeout=600):
    parsed = urlsplit(origin)
    assert parsed.scheme in ('http', 'https') and parsed.netloc and not parsed.path
    assert not parsed.username and not parsed.query and not parsed.fragment
    opener = build_opener(HTTPCookieProcessor(CookieJar()), NoRedirect())
    token = None

    def request(method, path, body=None, headers=None, expected=200):
        all_headers = {'Origin': origin, 'Content-Type': 'application/json', **(headers or {})}
        if token:
            all_headers['Authorization'] = 'Bearer ' + token
        req = Request(origin + path, method=method, headers=all_headers,
                      data=json.dumps(body).encode() if body is not None else None)
        try:
            response = opener.open(req, timeout=20)
        except HTTPError as error:
            response = error
        with response:
            assert response.status == expected, f'{method} {path}: HTTP {response.status}, expected {expected}'
            raw = response.read()
            return json.loads(raw) if raw else None, response.headers

    deadline = time.monotonic() + timeout
    while True:
        try:
            assert request('GET', '/release.json')[0]['revision'] == sha
            assert request('GET', '/api/release')[0]['data']['revision'] == sha
            assert request('GET', '/api/health')[0]['data'] == {'status': 'ok', 'database': 'ok'}
            break
        except (AssertionError, HTTPError, URLError, TimeoutError, ValueError, KeyError):
            if time.monotonic() >= deadline:
                raise RuntimeError('Release readiness failed: frontend/backend SHA and DB health must match') from None
            time.sleep(5)
    pid = None
    try:
        login, _ = request('POST', '/api/auth/login', {'loginId': login_id, 'password': password})
        token = login['data']['accessToken']
        request('GET', '/api/auth/me')
        created, _ = request('POST', '/api/projects', {'title': 'CI smoke ' + uuid4().hex[:12]}, expected=201)
        pid = created['data']['id']
        path = f'/api/projects/{pid}/document'
        initial, _ = request('GET', path)
        view = initial['data']
        project = {key: view['project'][key] for key in ('title', 'summary', 'categoryTag', 'targetDbms')}
        project['summary'] = 'CI smoke persisted ' + sha
        body = {'baseVersion': view['version'], 'mutationId': str(uuid4()),
                'project': project, 'payload': deepcopy(view['payload'])}
        saved, _ = request('PUT', path, body)
        read, headers = request('GET', path)
        assert read['data']['version'] == saved['data']['version'] == view['version'] + 1
        assert read['data']['project']['summary'] == project['summary']
        request('GET', path, headers={'If-None-Match': headers['ETag']}, expected=304)
    finally:
        try:
            if pid:
                request('PATCH', f'/api/projects/{pid}/archive', {'archived': True})
        finally:
            if token:
                csrf, _ = request('GET', '/api/auth/csrf')
                request('POST', '/api/auth/logout', headers={'X-CSRF-TOKEN': csrf['data']['csrfToken']})
    print('PASS: exact frontend/backend SHA, health, login, read/save/read, ETag 304, archive, logout')


if __name__ == '__main__':
    try:
        origin = os.environ['DEPLOY_URL']
        assert urlsplit(origin).scheme == 'https', 'Public smoke requires HTTPS'
        smoke(origin, os.environ['GITHUB_SHA'], os.environ['SMOKE_LOGIN_ID'], os.environ['SMOKE_PASSWORD'])
    except Exception as error:
        # Responses may contain OAuth/session credentials. Never print bodies or exception details.
        raise SystemExit('Public release smoke failed (' + type(error).__name__ + '); use the recovery runbook.') from None
