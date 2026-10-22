"""실제 Chrome·Flask·SQL·Redis와 로컬 Google provider fixture를 연결합니다."""
import json
from urllib.parse import parse_qs, urlencode, urlsplit

from test_auth_browser import browser_session, open_page, sign_in
from test_auth import auth_app, PASSWORD
from test_social_auth import google_app, signer, certificate_transport, state_repository


def test_browser_provider_fixture_redirect_cookie_and_memory_recovery(google_app, browser_session):
    app = google_app.app
    browser, origin = browser_session
    app.config["AUTH_FRONTEND_ORIGIN"] = origin
    app.extensions["google_provider"].redirect_uri = origin + "/api/auth/google/callback"
    app.add_url_rule("/auth/callback", "oauth_browser_callback", app.view_functions["harness"])
    context = browser.new_context()
    try:
        page = open_page(context, origin)
        assert sign_in(page) == "검증 A"
        saved = page.evaluate("password => fetch('/api/auth/email', {method:'POST',headers:{...window.auth.authorization(),'Content-Type':'application/json'},body:JSON.stringify({email:'Owner@GMAIL.com',password})}).then(async r=>({status:r.status,body:await r.json()}))", PASSWORD)
        assert saved == {"status": 200, "body": {"data": {"email": "Owner@GMAIL.com"}}}
        data = page.evaluate("password => fetch('/api/auth/google/link/start', {method:'POST',headers:{...window.auth.authorization(),'Content-Type':'application/json'},body:JSON.stringify({password})}).then(r=>r.json()).then(r=>r.data)", PASSWORD)
        params = parse_qs(urlsplit(data["authorizationUrl"]).query)
        state = params["state"][0]
        states = state_repository(app)
        google_app.record = json.loads(states.client.get(states.oauth_key(state)))
        assert page.evaluate("() => document.cookie") == ""
        binding = next(cookie for cookie in context.cookies() if cookie["name"] == "syncarch_google_binding")
        assert binding["httpOnly"] and binding["sameSite"] == "Lax" and binding["path"] == "/api/auth/google/"

        def provider_redirect(route):
            # Google UI/동의는 fixture입니다. code 교환·서명 검증·상태 소비는 실제 서버를 통과합니다.
            route.fulfill(status=302, headers={"Location": origin + "/api/auth/google/callback?" + urlencode({"state": state, "code": "fixture-code"})}, body="")
        context.route("https://accounts.google.com/**", provider_redirect)
        page.goto(data["authorizationUrl"])
        page.wait_for_url(origin + "/auth/callback?flow=link&linked=true")
        page.wait_for_function("Boolean(window.auth)")
        assert page.evaluate("() => Object.keys(window.auth.authorization()).length") == 0
        assert page.evaluate("() => window.auth.me().then(user=>user.displayName)") == "검증 A"
        assert page.evaluate("() => localStorage.length === 0 && sessionStorage.length === 0")
        assert "fixture-code" not in page.url and state not in page.url
        assert page.evaluate("() => document.cookie") == ""
        cookies = context.cookies()
        assert all(cookie["name"] != "syncarch_google_binding" for cookie in cookies)
        refresh = next(cookie for cookie in cookies if cookie["name"] == "syncarch_refresh")
        assert refresh["httpOnly"] and refresh["sameSite"] == "Lax" and refresh["path"] == "/api/auth/"
    finally:
        context.close()
