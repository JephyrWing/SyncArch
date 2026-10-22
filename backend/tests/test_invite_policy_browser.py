"""TC-TEAM-01: production React에서 실제 초대·보관·복원 흐름을 조작합니다."""
from pathlib import Path
import re

import pytest
from playwright.sync_api import expect
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import AppUser
from test_auth import auth_app, PASSWORD  # noqa: F401
from test_auth_browser import browser_session  # noqa: F401
from test_invite_policy import invite_state


ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def invite_users(auth_app):
    # 브라우저 fixture가 라우트를 등록하기 전에는 HTTP 요청을 하지 않는다. 로그인은 제품 폼에서만 한다.
    with auth_app.app_context():
        third = AppUser(login_id="auth-c", display_name="검증 C", password_hash=generate_password_hash(PASSWORD))
        db.session.add(third)
        db.session.commit()
        return {"app": auth_app, "owner_id": auth_app.config["TEST_AUTH_USER"], "outsider_id": third.id,
                "editor_id": db.session.scalar(select(AppUser.id).where(AppUser.login_id == "auth-b"))}


def product_login(context, origin, login_id):
    page = context.new_page()
    page.goto(origin)
    page.get_by_label("아이디", exact=True).fill(login_id)
    page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="로그인", exact=True).click()
    expect(page.get_by_role("heading", name="어떤 프로젝트에서 작업할까요?")).to_be_visible()
    return page


def project_row(page, title):
    return page.get_by_role("listitem").filter(has=page.get_by_role("button", name=title))


def displayed_code(page):
    code = page.locator("code").filter(has_text=re.compile(r"^[A-Z2-9]{4}-[A-Z2-9]{4}$"))
    expect(code).to_be_visible()
    return code.inner_text().replace("-", "")


def join_in_product(page, code):
    page.get_by_label("초대 코드", exact=True).fill(code)
    page.get_by_role("button", name="코드로 참가", exact=True).click()


def archive_in_product(page, title, archived):
    page.once("dialog", lambda dialog: dialog.accept())
    with page.expect_response(lambda response: response.request.method == "PATCH" and response.url.endswith("/archive")) as changed:
        project_row(page, title).get_by_role("button", name="프로젝트 보관" if archived else "프로젝트 복원", exact=True).click()
    assert changed.value.status == 200
    expect(project_row(page, title)).to_have_count(0)


def test_product_invite_rotation_existing_member_archive_restore(browser_session, invite_users):
    """A 생성/재발급, B 참여/역할보존, C 구코드·보관거부/복원후가입을 UI에서 확인한다."""
    browser, origin = browser_session
    users = invite_users
    contexts = [browser.new_context(viewport={"width": 1440, "height": 1000}) for _ in range(3)]
    try:
        owner, editor, outsider = [product_login(context, origin, login_id)
                                   for context, login_id in zip(contexts, ("auth-a", "auth-b", "auth-c"))]
        title = "W04 초대 정책 화면 검증"
        owner.get_by_label("프로젝트 이름", exact=True).fill(title)
        with owner.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/api/projects")) as created:
            owner.get_by_role("button", name="생성하고 팀장으로 시작", exact=True).click()
        assert created.value.status == 201
        pid = created.value.json()["data"]["id"]
        invite = owner.get_by_title("팀원에게 보낼 초대 코드", exact=True)
        invite.click()
        old = displayed_code(owner)
        owner.once("dialog", lambda dialog: dialog.accept())
        with owner.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/invite")) as rotated:
            owner.get_by_role("button", name="코드 재발급", exact=True).click()
        assert rotated.value.status == 200
        current = rotated.value.json()["data"]["code"]
        expect(owner.locator("code")).to_have_text(current[:4] + "-" + current[4:])
        assert current != old
        before = invite_state(users["app"], pid)
        join_in_product(outsider, old)
        expect(outsider.get_by_role("alert")).to_contain_text("초대 코드가 올바르지")
        assert invite_state(users["app"], pid) == before
        join_in_product(editor, current)
        expect(editor.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼")).to_be_visible()
        editor.reload()
        expect(project_row(editor, title)).to_contain_text("팀원")
        project_row(editor, title).get_by_role("button", name=title).click()
        expect(editor.get_by_title("팀원에게 보낼 초대 코드", exact=True)).to_have_count(0)
        member_before = invite_state(users["app"], pid)["ProjectMember"]
        owner.once("dialog", lambda dialog: dialog.accept())
        with owner.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/invite")) as second:
            owner.get_by_role("button", name="코드 재발급", exact=True).click()
        current = second.value.json()["data"]["code"]
        expect(owner.locator("code")).to_have_text(current[:4] + "-" + current[4:])
        assert invite_state(users["app"], pid)["ProjectMember"] == member_before
        editor.reload()
        expect(project_row(editor, title)).to_contain_text("팀원")
        project_row(editor, title).get_by_role("button", name=title).click()
        expect(editor.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼")).to_be_visible()
        owner.get_by_title("프로젝트 목록(생성·참가)으로", exact=True).click()
        archive_in_product(owner, title, True)
        owner.get_by_role("button", name="보관된 프로젝트", exact=True).click()
        project_row(owner, title).get_by_role("button", name=title).click()
        expect(owner.get_by_title("팀원에게 보낼 초대 코드", exact=True)).to_be_disabled()
        archived = invite_state(users["app"], pid)
        assert archived["Project"][0]["archived_at"] is not None
        join_in_product(outsider, current)
        expect(outsider.get_by_role("alert")).to_contain_text("보관된 프로젝트")
        assert invite_state(users["app"], pid) == archived
        owner.screenshot(path=str(ROOT / ".local/w04-invite-archived.png"))
        outsider.screenshot(path=str(ROOT / ".local/w04-invite-join-rejected.png"))
        owner.get_by_title("프로젝트 목록(생성·참가)으로", exact=True).click()
        owner.get_by_role("button", name="보관된 프로젝트", exact=True).click()
        archive_in_product(owner, title, False)
        owner.get_by_role("button", name="사용 중 프로젝트", exact=True).click()
        project_row(owner, title).get_by_role("button", name=title).click()
        owner.get_by_title("팀원에게 보낼 초대 코드", exact=True).click()
        assert displayed_code(owner) == current
        owner.screenshot(path=str(ROOT / ".local/w04-invite-restored.png"))
        join_in_product(outsider, current)
        expect(outsider.get_by_placeholder("예: 사내 스터디 매칭 & 출석 관리 플랫폼")).to_be_visible()
        outsider.reload()
        expect(project_row(outsider, title)).to_contain_text("팀원")
        assert {(row["user_id"], row["role"]) for row in invite_state(users["app"], pid)["ProjectMember"]} == {
            (users["owner_id"], "OWNER"), (users["editor_id"], "EDITOR"), (users["outsider_id"], "EDITOR")}
    finally:
        for context in contexts:
            context.close()
