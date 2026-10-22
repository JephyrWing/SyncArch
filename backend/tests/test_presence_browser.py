"""W15: 실제 React 빌드·Flask·Redis에서 같은 계정의 두 탭과 다른 계정으로 접속 표시를 확인합니다."""
import time

from playwright.sync_api import expect

from test_auth import auth_app  # noqa: F401
from test_auth_browser import browser_session  # noqa: F401
from test_auth_browser import open_page, sign_in
from test_projects_browser import api
from test_workspace_browser import workspace

TITLE = "W15 접속 표시"


def online_names(page, project_id):
    response = api(page, "POST", f"/api/projects/{project_id}/presence", {"step": 1})
    return response["status"], {entry["displayName"] for entry in response["data"] or []}


def test_closing_one_tab_keeps_the_other_tab_online_and_removed_member_drops_at_once(browser_session):
    """TC-COL-04: 한 탭이 프로젝트를 나가도 같은 계정의 다른 탭 접속은 남고, 제외된 멤버는 TTL 없이 빠집니다."""
    browser, origin = browser_session
    owner_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    editor_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    try:
        tab_a, pid = workspace(owner_context, origin, title=TITLE)
        setup = open_page(owner_context, origin)
        sign_in(setup)
        assert api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})["status"] == 200
        tab_b, _ = workspace(owner_context, origin, title=TITLE, project_id=pid)
        editor, _ = workspace(editor_context, origin, title=TITLE, login_id="auth-b", project_id=pid)
        watcher = open_page(editor_context, origin)
        sign_in(watcher, "auth-b")

        # 편집자 화면 머리글에 팀장이 접속 중으로 보입니다.
        expect(editor.locator('button[title*="소유자"][title*="보는 중"]')).to_be_visible(timeout=10000)

        # 탭 A만 목록으로 나가면 그 탭의 DELETE가 탭 B의 접속까지 지우지 않아야 합니다.
        tab_a.bring_to_front()
        with tab_a.expect_response(lambda r: r.request.method == "DELETE" and "/presence" in r.url) as left:
            tab_a.get_by_title("프로젝트 목록(생성·참가)으로").click()
        assert left.value.status == 204
        # 탭 B의 다음 신호(2초)를 기다리지 않고 바로, 그리고 그 뒤에도 계속 접속 중이어야 합니다.
        for _ in range(6):
            status, names = online_names(watcher, pid)
            assert status == 200 and "검증 A" in names
            time.sleep(0.4)

        # 팀장이 편집자를 제외하면 TTL(15초)을 기다리지 않고 바로 목록에서 빠집니다.
        assert "검증 B" in online_names(setup, pid)[1]
        assert api(setup, "DELETE", f"/api/projects/{pid}/members/{_user_id(setup, pid, '검증 B')}")["status"] in (200, 204)
        assert "검증 B" not in online_names(setup, pid)[1]
        assert online_names(watcher, pid)[0] == 404
    finally:
        owner_context.close()
        editor_context.close()


def _user_id(page, project_id, name):
    members = api(page, "GET", f"/api/projects/{project_id}/members")["data"]
    return next(member["id"] for member in members if member["displayName"] == name)
