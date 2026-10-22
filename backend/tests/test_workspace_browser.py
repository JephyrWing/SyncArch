"""W06: 실제 React 빌드·Flask·SQL·Redis와 통제한 네트워크 실패를 검증합니다."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
from urllib.request import urlopen

import pytest
from playwright.sync_api import expect
from sqlalchemy import select

from app.extensions import db
from app.models import AppUser
from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session, open_page, sign_in
from test_projects_browser import api


ROOT = Path(__file__).resolve().parents[2]
SUMMARY = "예: 사내 스터디 매칭 & 출석 관리 플랫폼"


def workspace(context, origin, title="W06 실제 편집", login_id="auth-a", project_id=None):
    page = open_page(context, origin)
    sign_in(page, login_id)
    if project_id is None:
        created = api(page, "POST", "/api/projects", {"title": title})
        assert created["status"] == 201
        project_id = created["data"]["id"]
    page.goto(origin + "/")
    page.get_by_role("button", name=title).click()
    expect(page.get_by_placeholder(SUMMARY)).to_be_visible()
    expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
    return page, project_id


def error_response(route, status, code):
    route.fulfill(status=status, content_type="application/json",
                  body=json.dumps({"error": {"code": code, "message": "검증용 실패"}}))


def test_email_ui_password_duplicate_save_and_draft_preservation(browser_session, auth_app):
    """TC-AUTH-01/04·SAVE-02: 실패 입력과 편집 초안을 지키며 같은 계정 이메일을 직접 저장합니다."""
    browser, origin = browser_session
    with auth_app.app_context():
        other = db.session.scalar(select(AppUser).where(AppUser.login_id == "auth-b"))
        other.email = other.email_normalized = "duplicate@example.com"
        db.session.commit()
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    try:
        page, pid = workspace(context, origin)
        page.route(f"**/api/projects/{pid}/document", lambda route: error_response(route, 503, "DB_UNAVAILABLE")
                   if route.request.method == "PUT" else route.continue_())
        page.get_by_placeholder(SUMMARY).fill("이메일 설정 중에도 남길 초안")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        page.get_by_role("button", name="이메일 등록/수정", exact=True).click()
        dialog = page.get_by_role("dialog", name="이메일 등록/수정")
        dialog.get_by_label("이메일 주소").fill("duplicate@example.com")
        dialog.get_by_label("본인 비밀번호").fill("wrong-password")
        dialog.get_by_role("button", name="이메일 저장").click()
        expect(dialog.get_by_role("alert")).to_contain_text("비밀번호")
        expect(dialog.get_by_label("이메일 주소")).to_have_value("duplicate@example.com")
        dialog.get_by_label("본인 비밀번호").fill(PASSWORD)
        dialog.get_by_role("button", name="이메일 저장").click()
        expect(dialog.get_by_role("alert")).to_contain_text("충돌")
        dialog.get_by_label("이메일 주소").fill("Owner+UI@GMAIL.com")
        dialog.get_by_role("button", name="이메일 저장").click()
        expect(dialog.get_by_role("status")).to_contain_text("Owner+UI@GMAIL.com")
        expect(dialog.get_by_label("본인 비밀번호")).to_have_value("")
        page.screenshot(path=str(ROOT / ".local/w06-email-ui.png"))
        page.get_by_role("button", name="이메일 설정 닫기").click()
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("이메일 설정 중에도 남길 초안")
        with auth_app.app_context():
            user = db.session.scalar(select(AppUser).where(AppUser.login_id == "auth-a"))
            assert user.id == auth_app.config["TEST_AUTH_USER"]
            assert user.email == "Owner+UI@GMAIL.com"
            assert user.email_normalized == "owner+ui@gmail.com"
            assert user.email_verified_at is None
        assert page.evaluate("() => !Object.keys(localStorage).some(k => /token|password/i.test(k)) && sessionStorage.length === 0")
    finally:
        context.close()


def test_two_account_product_edit_save_refresh_and_remote_poll(browser_session):
    """TC-SAVE-01·COL-01: 실제 편집 UI 저장을 다른 독립 계정과 새로고침 뒤 확인합니다."""
    browser, origin = browser_session
    owner_context, editor_context = browser.new_context(), browser.new_context()
    try:
        owner, pid = workspace(owner_context, origin)
        # API setup도 별도 페이지에서 수행해 제품 화면의 메모리 AT를 노출하지 않습니다.
        setup = open_page(owner_context, origin)
        sign_in(setup)
        member = api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})
        assert member["status"] == 200
        setup.close()
        editor, _ = workspace(editor_context, origin, login_id="auth-b", project_id=pid)
        owner.bring_to_front()
        owner.get_by_placeholder(SUMMARY).fill("두 계정 실제 저장")
        expect(owner.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        editor.bring_to_front()
        expect(editor.get_by_placeholder(SUMMARY)).to_have_value("두 계정 실제 저장", timeout=10000)
        owner.bring_to_front()
        owner.reload()
        owner.get_by_role("button", name="W06 실제 편집").click()
        expect(owner.get_by_placeholder(SUMMARY)).to_have_value("두 계정 실제 저장")
    finally:
        owner_context.close()
        editor_context.close()


@pytest.mark.parametrize(("endpoint", "status", "code"), [
    ("document", 401, "AUTH_REQUIRED"),
    ("presence", 403, "FORBIDDEN"),
    ("messages", 404, "NOT_FOUND"),
])
def test_access_loss_stops_all_polling_and_preserves_backup(browser_session, endpoint, status, code):
    """TC-AUTH-04·SAVE-02·COL-07: 어느 협업 요청에서 권한을 잃어도 전체 폴링을 멈춥니다."""
    browser, origin = browser_session
    context = browser.new_context(accept_downloads=True)
    try:
        page, pid = workspace(context, origin)
        page.route(f"**/api/projects/{pid}/document", lambda route: error_response(route, 503, "DB_UNAVAILABLE")
                   if route.request.method == "PUT" else route.continue_())
        page.get_by_placeholder(SUMMARY).fill("권한 상실에도 보존할 초안")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        page.route(f"**/api/projects/{pid}/{endpoint}*", lambda route: error_response(route, status, code)
                   if route.request.method != "PUT" else error_response(route, 503, "DB_UNAVAILABLE"))
        expect(page.get_by_role("alert").filter(has_text="연결을 중단했습니다")).to_be_visible(timeout=10000)
        requests = []
        page.on("request", lambda request: requests.append(request.url) if f"/api/projects/{pid}/" in request.url else None)
        page.wait_for_timeout(4500)
        assert requests == []
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("권한 상실에도 보존할 초안")
        with page.expect_download() as download:
            page.get_by_role("button", name="내 변경 백업(JSON)").click()
        backup = json.loads(Path(download.value.path()).read_text(encoding="utf-8"))
        assert backup["project"]["summary"] == "권한 상실에도 보존할 초안"
        assert backup["projectId"] == pid
    finally:
        context.close()


def test_repeated_conflict_has_limit_and_explicit_retry_keeps_new_input(browser_session):
    """TC-COL-03·SAVE-02/03: 409 자동 저장은 유한하며 재시도 중 추가 입력도 유지합니다."""
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, pid = workspace(context, origin)
        attempts = []
        def conflict(route):
            if route.request.method == "PUT":
                attempts.append(route.request.post_data_json)
                error_response(route, 409, "VERSION_CONFLICT")
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/document", conflict)
        page.get_by_placeholder(SUMMARY).fill("충돌 중 첫 입력")
        expect(page.get_by_role("alert").filter(has_text="동시 변경이 반복")).to_be_visible(timeout=15000)
        page.wait_for_timeout(2200)
        assert len(attempts) == 3
        assert len({attempt["mutationId"] for attempt in attempts}) == 3
        page.get_by_placeholder(SUMMARY).fill("실패 후 추가 입력도 유지")
        page.unroute(f"**/api/projects/{pid}/document", conflict)
        page.get_by_role("button", name="다시 시도", exact=True).click()
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=10000)
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("실패 후 추가 입력도 유지")
    finally:
        context.close()


def test_slow_document_poll_has_single_request(browser_session):
    """TC-SAVE-03·COL-01: 느린 GET과 포커스 이벤트가 중첩 조회를 만들지 않습니다."""
    browser, origin = browser_session
    context = browser.new_context()
    held = []
    try:
        page, pid = workspace(context, origin)
        page.route(f"**/api/projects/{pid}/document", lambda route: held.append(route))
        page.wait_for_timeout(3500)
        page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        page.wait_for_timeout(1000)
        assert len(held) == 1
        held.pop().fulfill(status=304)
        page.unroute(f"**/api/projects/{pid}/document")
    finally:
        context.close()


def test_forbidden_project_switch_shows_error_and_lobby_action(browser_session):
    """TC-SAVE-03: 다른 프로젝트의 로드 거부는 이전 ref 때문에 무한 로딩이 되지 않습니다."""
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, _ = workspace(context, origin)
        setup = open_page(context, origin)
        sign_in(setup)
        second = api(setup, "POST", "/api/projects", {"title": "접근 거부 대상"})["data"]["id"]
        setup.close()
        page.get_by_title("프로젝트 목록(생성·참가)으로").click()
        page.route(f"**/api/projects/{second}/document", lambda route: error_response(route, 404, "NOT_FOUND"))
        page.get_by_role("button", name="접근 거부 대상").click()
        expect(page.get_by_text("검증용 실패 연결을 중단했습니다.", exact=False)).to_be_visible()
        expect(page.get_by_role("button", name="목록으로", exact=True)).to_be_visible()
    finally:
        context.close()


def test_account_switch_during_401_does_not_replay_write_as_other_user(browser_session):
    """TC-AUTH-04: 공유 RT가 B로 바뀌면 A 화면의 저장을 B 토큰으로 재전송하지 않습니다."""
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, pid = workspace(context, origin)
        other = open_page(context, origin)
        sign_in(other, "auth-b")
        page.bring_to_front()
        writes = []
        def expired(route):
            if route.request.method == "PUT":
                writes.append(route.request.post_data_json)
                error_response(route, 401, "AUTH_REQUIRED")
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/document", expired)
        page.get_by_placeholder(SUMMARY).fill("A의 초안은 B로 저장하지 않음")
        expect(page.get_by_role("alert").filter(has_text="연결을 중단했습니다")).to_be_visible(timeout=10000)
        page.wait_for_timeout(2200)
        assert len(writes) == 1
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("A의 초안은 B로 저장하지 않음")
    finally:
        context.close()


def test_chat_send_response_cannot_leak_into_next_project(browser_session):
    """TC-COL-07·SAVE-03: 이전 프로젝트의 지연 채팅 응답은 새 프로젝트 상태를 바꾸지 않습니다."""
    browser, origin = browser_session
    context = browser.new_context()
    held = []
    try:
        page, pid = workspace(context, origin)
        setup = open_page(context, origin)
        sign_in(setup)
        api(setup, "POST", "/api/projects", {"title": "다음 채팅 프로젝트"})
        setup.close()
        page.bring_to_front()
        page.route(f"**/api/projects/{pid}/messages", lambda route: held.append(route)
                   if route.request.method == "POST" else route.continue_())
        page.get_by_role("button", name="팀 채팅 열기").click()
        page.get_by_role("textbox", name="메시지", exact=True).fill("이전 프로젝트 응답")
        page.get_by_role("button", name="보내기", exact=True).click()
        page.wait_for_timeout(100)
        assert len(held) == 1
        page.get_by_title("프로젝트 목록(생성·참가)으로").click()
        page.get_by_role("button", name="다음 채팅 프로젝트").click()
        expect(page.get_by_placeholder(SUMMARY)).to_be_visible()
        page.get_by_role("button", name="팀 채팅 열기").click()
        route = held.pop()
        route.fulfill(response=route.fetch())
        page.wait_for_timeout(1800)
        expect(page.get_by_role("region", name="팀 채팅").get_by_text("이전 프로젝트 응답", exact=True)).to_have_count(0)
    finally:
        context.close()


def test_late_401_after_logout_and_new_login_is_not_replayed(browser_session):
    """TC-AUTH-04·COL-07: 이전 로그인 세대의 늦은 401은 새 계정으로 재전송하지 않습니다."""
    browser, origin = browser_session
    context = browser.new_context()
    held, posts = [], []
    try:
        page, pid = workspace(context, origin)
        def hold(route):
            if route.request.method == "POST":
                posts.append(route.request.post_data_json)
                held.append(route)
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/messages", hold)
        page.get_by_role("button", name="팀 채팅 열기").click()
        page.get_by_role("textbox", name="메시지", exact=True).fill("A 로그인 세대의 메시지")
        page.get_by_role("button", name="보내기", exact=True).click()
        page.wait_for_timeout(100)
        assert len(held) == 1
        page.get_by_title("로그아웃", exact=True).click()
        expect(page.get_by_role("button", name="로그인", exact=True)).to_be_visible()
        page.get_by_role("textbox", name="아이디", exact=True).fill("auth-b")
        page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
        page.get_by_role("button", name="로그인", exact=True).click()
        expect(page.get_by_role("heading", name="어떤 프로젝트에서 작업할까요?")).to_be_visible()
        error_response(held.pop(), 401, "AUTH_REQUIRED")
        page.wait_for_timeout(1800)
        assert len(posts) == 1
    finally:
        context.close()


@pytest.mark.parametrize("signup", [False, True])
def test_vite_proxy_product_login_save_etag_and_logout(browser_session, auth_app, signup):
    """TC-VIEW-01·AUTH-04/05: 가입/로그인과 쿠키·Origin·ETag/304를 실제 프록시로 확인합니다."""
    browser, flask_origin = browser_session
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    auth_app.config["ALLOWED_ORIGINS"] = [origin]
    environment = {**os.environ, "API_PROXY_TARGET": flask_origin}
    log = (ROOT / ".local/w06-vite.log").open("w", encoding="utf-8")
    process = subprocess.Popen([shutil.which("node"), str(ROOT / "frontend/node_modules/vite/bin/vite.js"),
        "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=ROOT / "frontend",
        env=environment, stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    context = browser.new_context()
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Vite 검증 서버가 종료됐습니다. w06-vite.log를 확인하세요.")
            try:
                with urlopen(origin, timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Vite 검증 서버 시작 시간 초과")
        page = context.new_page()
        if signup:
            from test_registration_browser import form, finish_and_login
            form(page, origin, "vite-new-user")
            finish_and_login(page, "vite-new-user")
        else:
            page.goto(origin)
            page.get_by_role("textbox", name="아이디", exact=True).fill("auth-a")
            page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
            page.get_by_role("button", name="로그인", exact=True).click()
        expect(page.get_by_role("heading", name="어떤 프로젝트에서 작업할까요?")).to_be_visible()
        page.get_by_label("프로젝트 이름").fill("Vite 실제 프록시")
        page.get_by_role("button", name="생성하고 팀장으로 시작").click()
        page.get_by_placeholder(SUMMARY).fill("같은 출처 프록시 저장")
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        responses = []
        page.on("response", lambda response: responses.append(response.status) if "/document" in response.url else None)
        page.wait_for_timeout(2500)
        assert 304 in responses
        cookie = next(cookie for cookie in context.cookies() if cookie["name"] == "syncarch_refresh")
        assert cookie["httpOnly"] and cookie["path"] == "/api/auth/"
        page.reload()
        page.get_by_role("button", name="Vite 실제 프록시").click()
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("같은 출처 프록시 저장")
        page.get_by_title("로그아웃", exact=True).click()
        expect(page.get_by_role("button", name="로그인", exact=True)).to_be_visible()
        assert all(cookie["name"] != "syncarch_refresh" for cookie in context.cookies())
        assert context.request.get(origin + "/api/not-a-real-endpoint").status == 404
    finally:
        context.close()
        process.terminate()
        process.wait(timeout=10)
        log.close()


def test_delayed_save_is_serial_and_reconnect_cancel_preserves_draft(browser_session):
    """TC-SAVE-02/03: 서버 확인 전 저장됨을 표시하지 않고 후속 입력·이탈 보호를 유지합니다."""
    browser, origin = browser_session
    context = browser.new_context()
    held = []
    try:
        page, pid = workspace(context, origin)
        writes = []
        def delay(route):
            if route.request.method == "PUT":
                writes.append(route.request.post_data_json)
                if len(writes) == 1:
                    held.append(route)
                else:
                    route.continue_()
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/document", delay)
        page.get_by_placeholder(SUMMARY).fill("서버 응답 전 첫 입력")
        expect(page.get_by_role("status").filter(has_text="저장 중")).to_be_visible()
        page.get_by_placeholder(SUMMARY).fill("저장 중 추가 입력")
        page.get_by_title("프로젝트 목록(생성·참가)으로").click()
        page.wait_for_timeout(700)
        assert len(writes) == 1
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("저장 중 추가 입력")
        assert page.get_by_role("status").filter(has_text="저장됨").count() == 0
        route = held.pop()
        route.fulfill(response=route.fetch())
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=10000)
        assert len(writes) == 2
        assert writes[0]["mutationId"] != writes[1]["mutationId"]
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("저장 중 추가 입력")
        page.unroute(f"**/api/projects/{pid}/document", delay)
        page.route(f"**/api/projects/{pid}/document", lambda route: error_response(route, 503, "DB_UNAVAILABLE")
                   if route.request.method == "PUT" else route.continue_())
        page.get_by_placeholder(SUMMARY).fill("재연결 취소 뒤 남길 입력")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        page.route(f"**/api/projects/{pid}/presence", lambda route: error_response(route, 403, "FORBIDDEN"))
        expect(page.get_by_role("alert").filter(has_text="연결을 중단했습니다")).to_be_visible(timeout=10000)
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_role("button", name="다시 연결", exact=True).click()
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("재연결 취소 뒤 남길 입력")
    finally:
        context.close()
