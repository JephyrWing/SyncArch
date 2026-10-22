"""W06 TC-DASH-01/COL-06: 실제 React·Flask·SQL·Redis의 저장본 집계와 활동 조회."""
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in
from test_projects_browser import api
from test_workspace_browser import workspace, error_response, SUMMARY, ROOT


def save(setup, pid, *, summary=None, features=None, body=None):
    if body is None:
        view = api(setup, "GET", f"/api/projects/{pid}/document")["data"]
        body = {"baseVersion": view["version"], "mutationId": str(uuid4()),
                "project": {key: view["project"][key] for key in ("title", "summary", "categoryTag", "targetDbms")},
                "payload": view["payload"]}
        if summary is not None:
            body["project"]["summary"] = summary
        if features is not None:
            body["payload"]["features"] = features
    result = api(setup, "PUT", f"/api/projects/{pid}/document", body)
    assert result["status"] == 200
    return body


def open_overview(page):
    page.get_by_role("button", name="프로젝트 현황·활동 열기", exact=True).click()
    dialog = page.get_by_role("dialog", name="프로젝트 현황·활동", exact=True)
    expect(dialog).to_be_visible()
    return dialog


def test_dashboard_saved_progress_remote_change_reload_and_mobile(browser_session):
    """빈 기능0%·다른 계정의 실제 커밋50/100%·재접속·개인보기의 version 불변."""
    browser, origin = browser_session
    owner_context, editor_context = browser.new_context(viewport={"width": 1440, "height": 1000}), browser.new_context()
    try:
        setup = open_page(owner_context, origin)
        sign_in(setup)
        pid = api(setup, "POST", "/api/projects", {"title": "집계 검증"})["data"]["id"]
        api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})
        editor = open_page(editor_context, origin)
        sign_in(editor, "auth-b")
        page = owner_context.new_page()
        page.goto(origin)
        expect(page.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        features = [{"id": str(uuid4()), "name": "완료 기능", "status": "COMPLETED"},
                    {"id": str(uuid4()), "name": "예정 기능", "status": "PLANNED"}]
        save(editor, pid, features=features)
        page.bring_to_front()
        page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_label("기능 완료율", exact=True)).to_have_text("50%", timeout=10000)
        dialog = open_overview(page)
        expect(dialog.get_by_text("완료 1 / 전체 2개", exact=True)).to_be_visible()
        expect(dialog.get_by_role("list", name="프로젝트 활동 이력")).to_contain_text("검증 B")
        expect(dialog.get_by_role("list", name="프로젝트 활동 이력")).to_contain_text("완료 기능")
        version = api(setup, "GET", f"/api/projects/{pid}/document")["data"]["version"]
        dialog.get_by_role("button", name="현황 새로고침").click()
        assert api(setup, "GET", f"/api/projects/{pid}/document")["data"]["version"] == version
        page.screenshot(path=str(ROOT / ".local/w06-dashboard-desktop.png"))
        features[1]["status"] = "COMPLETED"
        save(editor, pid, features=features)
        page.bring_to_front()
        expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("100%", timeout=10000)
        dialog.get_by_role("button", name="현황 닫기").click()
        page.reload()
        expect(page.get_by_label("기능 완료율", exact=True)).to_have_text("100%")
        page.set_viewport_size({"width": 390, "height": 844})
        mobile = open_overview(page)
        expect(mobile.get_by_role("list", name="프로젝트 활동 이력")).to_be_visible()
        assert page.evaluate("() => document.documentElement.scrollWidth <= innerWidth")
        page.screenshot(path=str(ROOT / ".local/w06-dashboard-mobile.png"))
    finally:
        owner_context.close()
        editor_context.close()


def test_dashboard_activity_pages_replay_dedup_and_retry(browser_session):
    """20개 경계·멱등 재시도·페이지 오류 복구에서도 활동 누락/중복이 없다."""
    browser, origin = browser_session
    context = browser.new_context()
    try:
        setup = open_page(context, origin)
        sign_in(setup)
        pid = api(setup, "POST", "/api/projects", {"title": "활동 페이지"})["data"]["id"]
        for index in range(24):
            body = save(setup, pid, summary=f"저장 {index}")
        save(setup, pid, body=body)
        expected = api(setup, "GET", f"/api/projects/{pid}/activity?limit=100")["data"]["items"]
        page = context.new_page()
        page.goto(origin)
        dialog = open_overview(page)
        events = dialog.locator("[data-event-id]")
        expect(events).to_have_count(20)
        fail_once = [True]
        def unavailable(route):
            if fail_once[0]:
                fail_once[0] = False
                error_response(route, 503, "DB_UNAVAILABLE")
            else:
                route.continue_()
        page.route(f"**/api/projects/{pid}/activity?**", unavailable)
        dialog.get_by_role("button", name="이전 활동 더 보기").click()
        expect(dialog.get_by_role("alert")).to_contain_text("검증용 실패")
        expect(events).to_have_count(20)
        dialog.get_by_role("button", name="이력 다시 시도").click()
        expect(events).to_have_count(len(expected))
        actual = events.evaluate_all("nodes => nodes.map(node => node.dataset.eventId)")
        assert actual == [item["eventId"] for item in expected]
        assert len(actual) == len(set(actual))
        assert dialog.get_by_role("button", name="이전 활동 더 보기").count() == 0
    finally:
        context.close()


@pytest.mark.parametrize("endpoint", ["dashboard", "activity"])
def test_dashboard_access_loss_stops_collaboration_and_keeps_draft(browser_session, endpoint):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, pid = workspace(context, origin)
        page.route(f"**/api/projects/{pid}/document", lambda route: error_response(route, 503, "DB_UNAVAILABLE")
                   if route.request.method == "PUT" else route.continue_())
        page.get_by_placeholder(SUMMARY).fill("현황 권한 오류에도 남길 초안")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        if endpoint == "dashboard":
            dialog = open_overview(page)
            expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
            page.route(f"**/api/projects/{pid}/{endpoint}**", lambda route: error_response(route, 404, "NOT_FOUND"))
            dialog.get_by_role("button", name="현황 새로고침").click()
        else:
            page.route(f"**/api/projects/{pid}/{endpoint}**", lambda route: error_response(route, 404, "NOT_FOUND"))
            dialog = open_overview(page)
        expect(page.get_by_role("alert").filter(has_text="연결을 중단했습니다")).to_be_visible(timeout=10000)
        expect(dialog.get_by_role("alert")).to_contain_text("현황 조회를 중단")
        assert dialog.get_by_label("기능 완료율", exact=True).count() == 0
        sent = []
        page.on("request", lambda request: sent.append(request.url) if f"/api/projects/{pid}/" in request.url else None)
        page.wait_for_timeout(5500)
        assert sent == []
        dialog.get_by_role("button", name="현황 닫기").click()
        expect(page.get_by_placeholder(SUMMARY)).to_have_value("현황 권한 오류에도 남길 초안")
    finally:
        context.close()


@pytest.mark.parametrize("endpoint", ["dashboard", "activity"])
def test_dashboard_late_response_cannot_enter_next_project(browser_session, endpoint):
    browser, origin = browser_session
    context = browser.new_context()
    held = []
    try:
        page, pid = workspace(context, origin, title="이전 프로젝트")
        setup = open_page(context, origin)
        sign_in(setup)
        second = api(setup, "POST", "/api/projects", {"title": "다음 프로젝트"})["data"]["id"]
        save(setup, pid, features=[{"id": str(uuid4()), "name": "이전 프로젝트 전용 기능", "status": "COMPLETED"}])
        page.bring_to_front()
        page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        pattern = f"**/api/projects/{pid}/{endpoint}**"
        hold_once = [True]
        def delay(route):
            if hold_once[0]:
                hold_once[0] = False
                held.append((route, route.fetch()))
            else:
                route.continue_()
        if endpoint == "dashboard":
            dialog = open_overview(page)
            expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("100%", timeout=10000)
            page.route(pattern, delay)
            dialog.get_by_role("button", name="현황 새로고침").click()
        else:
            page.route(pattern, delay)
            dialog = open_overview(page)
        page.wait_for_timeout(200)
        assert held
        dialog.get_by_role("button", name="현황 닫기").click()
        page.get_by_title("프로젝트 목록(생성·참가)으로").click()
        page.get_by_role("button", name="다음 프로젝트", exact=False).click()
        expect(page.get_by_placeholder(SUMMARY)).to_be_visible()
        current = open_overview(page)
        expect(current.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        for route, response in held:
            route.fulfill(response=response)
        expect(current.get_by_text("이전 프로젝트 전용 기능", exact=False)).to_have_count(0)
        expect(current.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        assert api(setup, "GET", f"/api/projects/{second}/dashboard")["data"]["counts"]["features"] == 0
    finally:
        context.close()


def test_dashboard_slow_read_is_single_flight_and_keeps_last_snapshot(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    held = []
    try:
        page, pid = workspace(context, origin)
        dialog = open_overview(page)
        expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        pattern = f"**/api/projects/{pid}/dashboard"
        holding = [True]
        page.route(pattern, lambda route: held.append(route) if holding[0] else route.continue_())
        dialog.get_by_role("button", name="현황 새로고침").click()
        page.evaluate("() => { for(let i=0;i<3;i++) window.dispatchEvent(new Event('focus')); }")
        page.wait_for_timeout(5500)
        assert len(held) == 1
        holding[0] = False
        error_response(held.pop(), 503, "DB_UNAVAILABLE")
        expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        # 밀린 조회가 한 번 이어지고 정상 서버 집계로 복구된다.
        expect(dialog.get_by_role("button", name="현황 새로고침")).to_be_enabled()
    finally:
        context.close()


def test_dashboard_local_failed_draft_is_excluded_then_commit_refreshes(browser_session):
    """저장 실패 초안은 집계에 섞지 않고, 명시 재시도 커밋 후 같은 화면의 버전을 갱신한다."""
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page, pid = workspace(context, origin)
        dialog = open_overview(page)
        expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        expect(dialog.get_by_text("서버 저장본 v1 기준 · 미저장 편집 제외", exact=True)).to_be_visible()
        dialog.get_by_role("button", name="현황 닫기").click()
        writes = []
        def failed_save(route):
            if route.request.method == "PUT":
                writes.append(route.request.post_data_json)
                error_response(route, 503, "DB_UNAVAILABLE")
            else:
                route.continue_()
        pattern = f"**/api/projects/{pid}/document"
        page.route(pattern, failed_save)
        page.get_by_placeholder(SUMMARY).fill("집계에 섞지 않을 초안")
        expect(page.get_by_role("status").filter(has_text="저장 실패")).to_be_visible()
        dialog = open_overview(page)
        expect(dialog.get_by_text("서버 저장본 v1 기준 · 미저장 편집 제외", exact=True)).to_be_visible()
        assert len(writes) == 1
        dialog.get_by_role("button", name="현황 닫기").click()
        page.unroute(pattern, failed_save)
        page.get_by_role("button", name="다시 시도", exact=True).click()
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible()
        dialog = open_overview(page)
        expect(dialog.get_by_text("서버 저장본 v2 기준 · 미저장 편집 제외", exact=True)).to_be_visible()
        expect(dialog.get_by_role("list", name="프로젝트 활동 이력")).to_contain_text("v2")
    finally:
        context.close()


def test_dashboard_lobby_denied_project_does_not_stop_other_project(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        setup = open_page(context, origin)
        sign_in(setup)
        first = api(setup, "POST", "/api/projects", {"title": "권한 없는 카드"})["data"]["id"]
        api(setup, "POST", "/api/projects", {"title": "정상 카드"})
        page = context.new_page()
        page.route(f"**/api/projects/{first}/dashboard", lambda route: error_response(route, 404, "NOT_FOUND"))
        page.goto(origin)
        expect(page.get_by_role("alert").filter(has_text="현황 조회를 중단")).to_be_visible()
        expect(page.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
        page.get_by_role("button", name="정상 카드", exact=False).click()
        expect(page.get_by_placeholder(SUMMARY)).to_be_visible()
        dialog = open_overview(page)
        expect(dialog.get_by_label("기능 완료율", exact=True)).to_have_text("0%")
    finally:
        context.close()
