"""TC-AUTH-05·TEAM-01: 실제 가입 화면과 두 신규 계정의 접근 경계입니다."""
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from unittest.mock import patch

from playwright.sync_api import expect
from redis.exceptions import ConnectionError

from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session
from test_social_auth import google_app, signer, certificate_transport, state_repository


def form(page, origin, login_id, name="새 사용자", email=""):
    page.goto(origin + "/")
    page.get_by_role("button", name="처음이라면 회원가입").click()
    page.get_by_label("가입 아이디", exact=True).fill(login_id)
    page.get_by_label("이름", exact=True).fill(name)
    page.get_by_label("가입 이메일", exact=True).fill(email)
    page.get_by_label("가입 비밀번호", exact=True).fill(PASSWORD)
    page.get_by_label("비밀번호 확인", exact=True).fill(PASSWORD)


def finish_and_login(page, login_id):
    page.get_by_role("button", name="회원가입 완료", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("회원가입이 완료")
    expect(page.get_by_label("아이디", exact=True)).to_have_value(login_id)
    expect(page.get_by_label("비밀번호", exact=True)).to_have_value("")
    page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="로그인", exact=True).click()
    expect(page.get_by_role("heading", name="어떤 프로젝트에서 작업할까요?")).to_be_visible()


def test_registration_real_ui_two_accounts_create_join_reload_and_relogin(browser_session):
    browser, origin = browser_session
    first, second = browser.new_context(), browser.new_context()
    try:
        owner, member = first.new_page(), second.new_page()
        form(owner, origin, "signup-owner", "가입 팀장", "owner.signup@gmail.com")
        finish_and_login(owner, "signup-owner")
        expect(owner.get_by_text("아직 참여한 프로젝트가 없습니다.")).to_be_visible()
        owner.get_by_label("프로젝트 이름", exact=True).fill("가입 후 공동 프로젝트")
        owner.get_by_role("button", name="생성하고 팀장으로 시작").click()
        expect(owner.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        owner.get_by_role("button", name="초대 코드", exact=True).click()
        # 초대 코드의 실제 제품 UI에서 값을 읽어 신규 팀원 화면에 전달합니다.
        expect(owner.locator('code')).to_have_text(re.compile(r"[A-Z0-9]{4}-[A-Z0-9]{4}"))
        code = owner.locator('code').inner_text()
        owner.get_by_role("button", name="닫기", exact=True).click()
        form(member, origin, "signup-member", "가입 팀원")
        finish_and_login(member, "signup-member")
        expect(member.get_by_text("아직 참여한 프로젝트가 없습니다.")).to_be_visible()
        member.get_by_label("초대 코드", exact=True).fill(code)
        member.get_by_role("button", name="코드로 참가", exact=True).click()
        expect(member.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        expect(member.get_by_role("button", name="초대 코드", exact=True)).to_have_count(0)
        member.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼").fill("신규 팀원이 저장한 소개")
        expect(member.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        owner.bring_to_front()
        expect(owner.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼")).to_have_value("신규 팀원이 저장한 소개", timeout=10000)
        member.reload()
        member.get_by_role("button", name="가입 후 공동 프로젝트").click()
        expect(member.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼")).to_have_value("신규 팀원이 저장한 소개")
        member.get_by_title("로그아웃", exact=True).click()
        expect(member.get_by_role("heading", name="팀 설계 공간에 로그인")).to_be_visible()
        member.get_by_label("아이디", exact=True).fill("signup-member")
        member.get_by_label("비밀번호", exact=True).fill(PASSWORD)
        member.get_by_role("button", name="로그인", exact=True).click()
        expect(member.get_by_role("button", name="가입 후 공동 프로젝트")).to_be_visible()
        assert not any("refresh" in item or "accessToken" in item for item in member.evaluate("Object.keys(localStorage)"))
    finally:
        first.close()
        second.close()


def test_registration_form_validation_duplicate_failure_and_single_submit(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page = context.new_page()
        form(page, origin, "auth-a")
        writes = []
        page.on("request", lambda request: writes.append(request.post_data_json) if request.url.endswith("/api/auth/register") else None)
        page.get_by_label("비밀번호 확인", exact=True).fill("different")
        page.get_by_role("button", name="회원가입 완료", exact=True).click()
        expect(page.get_by_role("alert")).to_contain_text("비밀번호 확인이 일치")
        assert writes == []
        page.get_by_label("비밀번호 확인", exact=True).fill(PASSWORD)
        page.get_by_role("button", name="회원가입 완료", exact=True).click()
        expect(page.get_by_role("alert")).to_contain_text("이미 사용 중인 아이디 또는 이메일")
        expect(page.get_by_label("가입 아이디", exact=True)).to_have_value("auth-a")
        page.get_by_label("가입 아이디", exact=True).fill("signup-retry")
        held = []
        page.route("**/api/auth/register", lambda route: held.append(route))
        page.get_by_role("button", name="회원가입 완료", exact=True).click()
        expect(page.get_by_role("button", name="가입하는 중…")).to_be_disabled()
        page.get_by_role("button", name="가입하는 중…").evaluate("button => { button.form.requestSubmit(); button.form.requestSubmit(); }")
        assert len(held) == 1
        held.pop().fulfill(status=503, content_type="application/json", body=json.dumps({"error": {"code": "DB_UNAVAILABLE", "message": "검증 실패"}}))
        expect(page.get_by_role("alert")).to_contain_text("회원가입을 저장하지 못했습니다")
        expect(page.get_by_label("이름", exact=True)).to_have_value("새 사용자")
        page.unroute("**/api/auth/register")
        finish_and_login(page, "signup-retry")
    finally:
        context.close()


def test_registration_success_stays_success_when_redis_login_is_down(browser_session, auth_app):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page = context.new_page()
        form(page, origin, "signup-redis")
        with patch.object(auth_app.extensions["token_repository"].client, "eval", side_effect=ConnectionError("private-redis")):
            page.get_by_role("button", name="회원가입 완료", exact=True).click()
            expect(page.get_by_role("status")).to_contain_text("회원가입이 완료")
            page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
            page.get_by_role("button", name="로그인", exact=True).click()
            expect(page.get_by_role("alert")).to_contain_text("계정은 유지됩니다")
        page.get_by_role("button", name="로그인", exact=True).click()
        expect(page.get_by_role("heading", name="어떤 프로젝트에서 작업할까요?")).to_be_visible()
    finally:
        context.close()


def test_registration_mobile_form_and_back_navigation(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 390, "height": 844})
    try:
        page = context.new_page()
        form(page, origin, "mobile-new")
        expect(page.get_by_role("heading", name="SyncArch 회원가입")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.screenshot(path=str(Path(__file__).resolve().parents[1] / ".local/w16-registration-mobile.png"), full_page=True)
        page.get_by_role("button", name="로그인으로 돌아가기").click()
        expect(page.get_by_role("heading", name="팀 설계 공간에 로그인")).to_be_visible()
    finally:
        context.close()


def test_registration_google_password_link_ui_and_existing_google_login(google_app, browser_session):
    browser, origin = browser_session
    app = google_app.app
    app.config["AUTH_FRONTEND_ORIGIN"] = origin
    app.extensions["google_provider"].redirect_uri = origin + "/api/auth/google/callback"
    context = browser.new_context()
    try:
        page = context.new_page()
        form(page, origin, "signup-google", "Google 연결 사용자", "owner@gmail.com")
        finish_and_login(page, "signup-google")
        page.get_by_role("button", name="Google 연결", exact=True).click()
        page.get_by_label("Google 연결 비밀번호", exact=True).fill("wrong")
        page.get_by_role("button", name="비밀번호 확인 후 Google 연결", exact=True).click()
        expect(page.get_by_role("alert")).to_contain_text("비밀번호 또는 로그인 상태")
        page.get_by_label("Google 연결 비밀번호", exact=True).fill(PASSWORD)
        def redirect_provider(route):
            state = parse_qs(urlsplit(route.request.url).query)["state"][0]
            states = state_repository(app)
            google_app.record = json.loads(states.client.get(states.oauth_key(state)))
            route.fulfill(status=302, headers={"Location": origin + "/api/auth/google/callback?" + urlencode({"state": state, "code": "fixture-code"})}, body="")
        context.route("https://accounts.google.com/**", redirect_provider)
        page.get_by_role("button", name="비밀번호 확인 후 Google 연결", exact=True).click()
        expect(page.get_by_text("Google 계정을 연결했습니다.", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Google 연결 사용자 로그아웃")).to_be_visible()
        page.get_by_role("button", name="Google 연결 사용자 로그아웃").click()
        with page.expect_response(lambda response: response.url.endswith("/api/auth/refresh") and response.status == 200, timeout=20000):
            page.get_by_role("button", name="Google 계정으로 로그인").click()
        expect(page.get_by_role("button", name="Google 연결 사용자 로그아웃")).to_be_visible()
        assert page.url == origin + "/"
    finally:
        context.close()


def test_google_link_cannot_navigate_away_from_unsaved_draft(google_app, browser_session):
    from test_workspace_browser import workspace, SUMMARY
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, pid = workspace(context, origin)
        def fail_save(route):
            if route.request.method == "PUT":
                route.fulfill(status=503, content_type="application/json", body=json.dumps({"error": {"code": "DB_UNAVAILABLE", "message": "검증 실패"}}))
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/document", fail_save)
        page.get_by_placeholder(SUMMARY).fill("Google 이동 전에 보존할 초안")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        requests = []
        page.on("request", lambda request: requests.append(request) if request.url.endswith("/api/auth/google/link/start") else None)
        page.get_by_role("button", name="Google 연결", exact=True).click()
        page.get_by_label("Google 연결 비밀번호", exact=True).fill(PASSWORD)
        page.get_by_role("button", name="비밀번호 확인 후 Google 연결", exact=True).click()
        expect(page.get_by_role("dialog").get_by_role("alert")).to_contain_text("저장되지 않은 변경")
        assert requests == []
        page.get_by_role("button", name="취소", exact=True).click()
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("Google 이동 전에 보존할 초안")
    finally:
        context.close()
