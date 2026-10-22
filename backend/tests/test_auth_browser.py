"""TC-AUTH-01/03/04: 실제 브라우저·Flask·SQL DB·Redis 인증 경계입니다."""
from pathlib import Path
import subprocess
from threading import Thread

import pytest
from flask import send_file
from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server, WSGIRequestHandler

from test_auth import auth_app, PASSWORD

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(WSGIRequestHandler):
    def log(self, *args, **kwargs):
        # 요청/헤더에 인증 정보가 들어가므로 브라우저 검증의 접속 로그는 남기지 않습니다.
        pass


@pytest.fixture
def browser_session(auth_app, tmp_path):
    # 테스트 소스는 .local의 수동 생성 번들에 의존하지 않는다. 실제 인증 클라이언트를 임시 디렉터리에 빌드한다.
    module = tmp_path / "auth-client.js"
    # npm installs a native ELF binary on Linux and a JS launcher on Windows.
    # Use the supported JS API on both systems instead of passing that binary to Node.
    subprocess.run(["node", "--input-type=module", "-e",
                    "import esbuild from 'esbuild'; esbuild.buildSync({entryPoints:[process.argv[1]],"
                    "bundle:true,format:'esm',platform:'browser',outfile:process.argv[2]})",
                    str(ROOT / "frontend/src/api/auth.ts"), str(module)],
                   cwd=ROOT / "frontend", check=True, capture_output=True)
    @auth_app.get("/__auth_client.js")
    def auth_module():
        return send_file(module, mimetype="text/javascript")

    @auth_app.get("/__auth_browser")
    def harness():
        return '<!doctype html><title>인증 검증</title><script type="module">import {AuthClient} from "/__auth_client.js";window.auth = new AuthClient();</script>'

    server = make_server("127.0.0.1", 0, auth_app, threaded=True, request_handler=QuietHandler)
    origin = f"http://127.0.0.1:{server.server_port}"
    auth_app.config["ALLOWED_ORIGINS"] = [origin]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            try:
                yield browser, origin
            finally:
                browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=10)
        server.server_close()


def open_page(context, origin):
    page = context.new_page()
    page.goto(origin + "/__auth_browser")
    page.wait_for_function("Boolean(window.auth)")
    return page


def sign_in(page, login_id="auth-a"):
    return page.evaluate("([loginId,password]) => window.auth.login(loginId,password).then(user=>user.displayName)", [login_id, PASSWORD])


def test_browser_refresh_memory_cookie_and_logout(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page = open_page(context, origin)
        assert sign_in(page) == "검증 A"
        assert page.evaluate("() => localStorage.length === 0 && sessionStorage.length === 0") is True
        assert page.evaluate("() => document.cookie.includes('syncarch_refresh')") is False
        cookies = context.cookies()
        assert len(cookies) == 1
        assert cookies[0]["httpOnly"] is True
        assert cookies[0]["path"] == "/api/auth/"
        page.reload()
        page.wait_for_function("Boolean(window.auth)")
        assert page.evaluate("() => Object.keys(window.auth.authorization()).length") == 0
        assert page.evaluate("() => window.auth.me().then(user=>user.displayName)") == "검증 A"
        page.evaluate("() => window.auth.logout()")
        assert context.cookies() == []
        assert page.evaluate("() => Object.keys(window.auth.authorization()).length") == 0
        assert page.evaluate("() => fetch('/api/auth/me').then(r=>r.status)") == 401
    finally:
        context.close()


def test_browser_single_flight_and_cross_tab_rotation(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        first = open_page(context, origin)
        assert sign_in(first) == "검증 A"
        assert first.evaluate("() => { const a=window.auth.refresh();const b=window.auth.refresh();return a===b; }") is True
        first.evaluate("() => window.auth.refresh()")
        second = open_page(context, origin)
        assert first.evaluate("() => Boolean(navigator.locks)") is True
        first.evaluate("() => {window.rotation=Promise.all(Array.from({length:5},()=>window.auth.refresh())).then(()=>true);}")
        second.evaluate("() => {window.rotation=Promise.all(Array.from({length:5},()=>window.auth.refresh())).then(()=>true);}")
        assert first.evaluate("() => window.rotation") is True
        assert second.evaluate("() => window.rotation") is True
        assert first.evaluate("() => window.auth.me().then(u=>u.displayName)") == "검증 A"
        assert second.evaluate("() => window.auth.me().then(u=>u.displayName)") == "검증 A"
    finally:
        context.close()


def test_browser_independent_accounts_and_forged_origin(browser_session):
    browser, origin = browser_session
    first_context = browser.new_context()
    second_context = browser.new_context()
    try:
        first = open_page(first_context, origin)
        second = open_page(second_context, origin)
        assert sign_in(first) == "검증 A"
        assert sign_in(second, "auth-b") == "검증 B"
        assert first.evaluate("() => window.auth.me().then(u=>u.displayName)") == "검증 A"
        assert second.evaluate("() => window.auth.me().then(u=>u.displayName)") == "검증 B"
        response = second_context.request.post(origin + "/api/auth/refresh", headers={"Origin": "https://evil.example"})
        assert response.status == 400
        assert response.json()["error"]["code"] == "CSRF_FAILED"
    finally:
        first_context.close()
        second_context.close()
