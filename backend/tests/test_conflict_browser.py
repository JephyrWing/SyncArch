"""W15: 실제 React 빌드·Flask·SQL·Redis에서 두 계정이 같은 필드를 동시에 고친 경우를 확인합니다."""
from playwright.sync_api import expect

from test_auth import auth_app  # noqa: F401
from test_auth_browser import browser_session  # noqa: F401
from test_auth_browser import open_page, sign_in
from test_projects_browser import api
from test_workspace_browser import SUMMARY, workspace

TITLE = "W15 같은 필드"


def test_same_field_conflict_keeps_the_later_writer_value_after_a_real_409(browser_session):
    """TC-COL-03: 같은 필드를 두 계정이 함께 고치면 늦게 저장한 쪽은 409 뒤 최신본에 다시 맞춰 자기 값을 남깁니다."""
    browser, origin = browser_session
    owner_context, editor_context = browser.new_context(), browser.new_context()
    try:
        owner, pid = workspace(owner_context, origin, title=TITLE)
        setup = open_page(owner_context, origin)
        sign_in(setup)
        assert api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})["status"] == 200
        editor, _ = workspace(editor_context, origin, title=TITLE, login_id="auth-b", project_id=pid)
        base_version = api(setup, "GET", f"/api/projects/{pid}/document")["data"]["version"]

        # 편집자의 저장을 붙잡아 둔 사이 팀장이 같은 필드를 먼저 저장해, 편집자 요청이 진짜로 낡은 버전이 되게 합니다.
        held, puts = [], []
        def hold(route):
            if route.request.method == "PUT":
                puts.append(route.request.post_data_json["baseVersion"])
                if not held and len(puts) == 1:
                    held.append(route)
                    return
            route.continue_()
        editor.route(f"**/api/projects/{pid}/document", hold)
        editor.bring_to_front()
        editor.get_by_placeholder(SUMMARY).fill("편집자가 쓴 한 줄 정의")
        expect(editor.get_by_role("status").filter(has_text="저장 중")).to_be_visible()
        editor.wait_for_timeout(500)
        assert len(held) == 1 and puts == [base_version]

        owner.bring_to_front()
        owner.get_by_placeholder(SUMMARY).fill("팀장이 쓴 한 줄 정의")
        expect(owner.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=10000)
        assert api(setup, "GET", f"/api/projects/{pid}/document")["data"]["version"] == base_version + 1

        # 붙잡은 요청을 보내면 서버가 409를 주고, 편집자 화면이 최신본 위에 자기 값을 다시 저장합니다.
        editor.bring_to_front()
        with editor.expect_response(lambda r: r.request.method == "PUT" and r.status == 409) as conflict:
            held.pop().continue_()
        assert conflict.value.json()["error"]["code"] == "VERSION_CONFLICT"
        expect(editor.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=15000)
        editor.unroute(f"**/api/projects/{pid}/document", hold)
        assert puts[-1] == base_version + 1, "다시 저장은 최신 버전을 기준으로 보냅니다"

        stored = api(setup, "GET", f"/api/projects/{pid}/document")["data"]
        assert stored["version"] == base_version + 2
        assert stored["project"]["summary"] == "편집자가 쓴 한 줄 정의"
        expect(editor.get_by_placeholder(SUMMARY)).to_have_value("편집자가 쓴 한 줄 정의")
        owner.bring_to_front()
        expect(owner.get_by_placeholder(SUMMARY)).to_have_value("편집자가 쓴 한 줄 정의", timeout=10000)
    finally:
        owner_context.close()
        editor_context.close()
