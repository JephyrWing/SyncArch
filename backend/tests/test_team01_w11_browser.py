"""W11 TEAM01: 실제 초대 재발급 UI와 W04 보관 정책을 교차 검증합니다."""
import re
from pathlib import Path

from playwright.sync_api import expect

from test_auth import auth_app  # noqa: F401
from test_auth_browser import browser_session, open_page, sign_in
from test_projects_browser import api
from test_workspace_browser import workspace, SUMMARY
from test_invite_policy_browser import archive_in_product

ROOT = Path(__file__).resolve().parents[2]


def test_owner_reissue_cancel_old_code_and_existing_members(browser_session):
    browser, origin = browser_session
    a, b = browser.new_context(), browser.new_context()
    try:
        owner, pid = workspace(a, origin, "W11 TEAM01 재발급")
        owner.get_by_role("button", name="초대 코드", exact=True).click()
        shown = owner.locator("code").filter(has_text="-")
        expect(shown).to_have_text(re.compile(r"[A-Z2-9]{4}-[A-Z2-9]{4}"))
        old = shown.inner_text()
        owner.once("dialog", lambda dialog: dialog.dismiss())
        owner.get_by_role("button", name="코드 재발급", exact=True).click()
        expect(shown).to_have_text(old)
        owner.once("dialog", lambda dialog: dialog.accept())
        owner.get_by_role("button", name="코드 재발급", exact=True).click()
        expect(shown).not_to_have_text(old)
        new = shown.inner_text()
        editor_auth = open_page(b, origin)
        sign_in(editor_auth, "auth-b")
        editor = b.new_page()
        editor.goto(origin + "/")
        editor.get_by_label("초대 코드", exact=True).fill(old)
        editor.get_by_role("button", name="코드로 참가", exact=True).click()
        expect(editor.get_by_role("alert")).to_be_visible()
        assert api(editor_auth, "GET", "/api/projects")["data"] == []
        editor.get_by_label("초대 코드", exact=True).fill(new.lower())
        editor.get_by_role("button", name="코드로 참가", exact=True).click()
        expect(editor.get_by_placeholder(SUMMARY)).to_be_visible()
        expect(editor.get_by_role("button", name="초대 코드", exact=True)).to_have_count(0)
        assert api(editor_auth, "POST", f"/api/projects/{pid}/invite")["status"] == 403
        before = api(editor_auth, "GET", f"/api/projects/{pid}/document")["data"]
        owner.once("dialog", lambda dialog: dialog.accept())
        owner.get_by_role("button", name="코드 재발급", exact=True).click()
        expect(shown).not_to_have_text(new)
        expect(editor.get_by_placeholder(SUMMARY)).to_be_visible()
        after = api(editor_auth, "GET", f"/api/projects/{pid}/document")["data"]
        assert before["version"] == after["version"]
        assert before["payload"] == after["payload"]
        assert len(api(editor_auth, "GET", f"/api/projects/{pid}/members")["data"]) == 2
        owner.screenshot(path=str(ROOT / ".local/w11-team01-reissue.png"))
    finally:
        a.close()
        b.close()


def test_archived_owner_invite_requests_are_rejected_without_document_changes(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page = open_page(context, origin)
        sign_in(page)
        project = api(page, "POST", "/api/projects", {"title": "W11 TEAM01 보관"})["data"]
        pid = project["id"]
        api(page, "GET", f"/api/projects/{pid}/invite")
        assert api(page, "PATCH", f"/api/projects/{pid}/archive", {"archived": True})["status"] == 200
        before = api(page, "GET", f"/api/projects/{pid}/document")["data"]
        for method in ("GET", "POST"):
            assert api(page, method, f"/api/projects/{pid}/invite")["status"] == 403
        assert api(page, "GET", f"/api/projects/{pid}/document")["data"] == before
    finally:
        context.close()


def test_owner_can_archive_open_readonly_and_restore_from_lobby(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        owner, _ = workspace(context, origin, "W11 TEAM01 보관 UI")
        owner.get_by_title("프로젝트 목록(생성·참가)으로").click()
        archive_in_product(owner, "W11 TEAM01 보관 UI", True)
        owner.get_by_role("button", name="보관된 프로젝트", exact=True).click()
        owner.get_by_role("button", name="W11 TEAM01 보관 UI").click()
        expect(owner.get_by_placeholder(SUMMARY)).to_be_disabled()
        expect(owner.get_by_role("button", name="초대 코드", exact=True)).to_be_disabled()
        owner.screenshot(path=str(ROOT / ".local/w11-team01-archived.png"))
        owner.get_by_title("프로젝트 목록(생성·참가)으로").click()
        owner.get_by_role("button", name="보관된 프로젝트", exact=True).click()
        archive_in_product(owner, "W11 TEAM01 보관 UI", False)
        owner.get_by_role("button", name="사용 중 프로젝트", exact=True).click()
        owner.get_by_role("button", name="W11 TEAM01 보관 UI").click()
        expect(owner.get_by_placeholder(SUMMARY)).to_be_enabled()
        expect(owner.get_by_role("button", name="초대 코드", exact=True)).to_be_enabled()
    finally:
        context.close()
