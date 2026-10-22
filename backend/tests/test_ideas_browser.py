"""W07A: 실제 React 편집·취소·검증과 Flask 저장/두 계정 회귀입니다."""
from pathlib import Path
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def idea_editor(browser_session, auth_app):
    browser, origin = browser_session
    if not (ROOT / "frontend/dist/index.html").is_file():
        raise RuntimeError("먼저 frontend에서 npm run build를 실행하세요.")
    client = auth_app.test_client()
    login = client.post("/api/auth/login", headers={"Origin": origin}, json={"loginId": "auth-a", "password": PASSWORD})
    headers = {"Authorization": "Bearer " + login.json["data"]["accessToken"]}
    response = client.post("/api/projects", headers=headers, json={"title": "W07A 화면 검증"})
    assert response.status_code == 201
    pid = response.json["data"]["id"]
    url = f"/api/projects/{pid}/document"
    member = client.post(f"/api/projects/{pid}/members", headers=headers, json={"loginId": "auth-b"})
    assert member.status_code == 200
    document = client.get(url, headers=headers).json["data"]
    ids = [str(uuid4()) for _ in range(4)]
    document["payload"]["ideas"] = [
        {"id": ids[0], "title": "원본 아이디어", "description": "원래 설명", "category": "problems_goals", "decisionStatus": "REVIEW",
         "voterIds": [auth_app.config["TEST_AUTH_USER"]], "comments": [{"id": str(uuid4()), "text": "보존할 댓글"}]},
        {"id": ids[1], "title": "자식 아이디어", "category": "problems_goals", "parentIdeaId": ids[0]},
        {"id": ids[2], "title": "손자 아이디어", "category": "problems_goals", "parentIdeaId": ids[1]},
        {"id": ids[3], "title": "다른 아이디어", "category": "constraints"},
    ]
    saved = client.put(url, headers=headers, json={"baseVersion": document["version"], "mutationId": str(uuid4()),
        "project": {"title": "W07A 화면 검증"}, "payload": document["payload"]})
    assert saved.status_code == 200
    def read():
        result = client.get(url, headers=headers)
        assert result.status_code == 200
        return result.json["data"]
    def open_editor(login_id="auth-a", viewport=None):
        context = browser.new_context(viewport=viewport or {"width": 1440, "height": 1000})
        page = context.new_page()
        page.goto(origin)
        page.get_by_label("아이디", exact=True).fill(login_id)
        page.get_by_label("비밀번호", exact=True).fill(PASSWORD)
        page.get_by_role("button", name="로그인", exact=True).click()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        expect(page.get_by_title("아이디어 수정").first).to_be_visible()
        return context, page
    yield {"read": read, "open": open_editor, "ids": ids, "client": client, "headers": headers, "url": url}


def edit(page, index=0):
    page.get_by_title("아이디어 수정").nth(index).click()
    return page.get_by_role("dialog", name="아이디어 수정")


def applied(page):
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=15000)


def test_idea_edit_persists_tree_category_identity_and_reload(idea_editor):
    """TC-IDEA-01/02·AUTH-02: B의 편집이 A의 작성자·댓글·표를 바꾸지 않는다."""
    ctx, page = idea_editor["open"]("auth-b")
    try:
        before = idea_editor["read"]()
        modal = edit(page)
        modal.get_by_label("제목 (필수)", exact=True).fill("수정한 아이디어")
        modal.get_by_label("설명", exact=True).fill("변경한 설명")
        modal.get_by_label("분류", exact=True).select_option("actors")
        modal.get_by_label("결정 상태", exact=True).select_option("ACCEPTED")
        modal.get_by_label("결정 사유", exact=False).fill("사용자 검증을 마쳐 채택")
        modal.get_by_role("button", name="적용", exact=True).click()
        applied(page)
        after = idea_editor["read"]()
        cards = after["payload"]["ideas"]
        assert [c["category"] for c in cards] == ["actors", "actors", "actors", "constraints"]
        assert cards[0]["title"] == "수정한 아이디어" and cards[0]["description"] == "변경한 설명"
        for key in ("id", "authorId", "author", "comments", "voterIds", "votes", "votedBy"):
            assert cards[0].get(key) == before["payload"]["ideas"][0].get(key)
        assert cards[0]["decidedBy"] != cards[0]["authorId"]
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        modal = edit(page)
        expect(modal.get_by_label("제목 (필수)", exact=True)).to_have_value("수정한 아이디어")
        expect(modal.get_by_label("설명", exact=True)).to_have_value("변경한 설명")
        expect(modal.get_by_label("분류", exact=True)).to_have_value("actors")
        expect(modal.get_by_label("결정 사유", exact=False)).to_have_value("사용자 검증을 마쳐 채택")
        modal.get_by_role("button", name="취소", exact=True).click()
        child = edit(page, 1)
        expect(child.get_by_label("분류", exact=True)).to_be_disabled()
    finally:
        ctx.close()


def test_idea_validation_and_cancel_do_not_save(idea_editor):
    """TC-IDEA-01/02: 빈 입력·상한 초과·사유 누락·취소는 저장하지 않는다."""
    ctx, page = idea_editor["open"]()
    try:
        before = idea_editor["read"]()
        modal = edit(page)
        apply = modal.get_by_role("button", name="적용", exact=True)
        title = modal.get_by_label("제목 (필수)", exact=True)
        title.fill("   ")
        expect(apply).to_be_disabled()
        expect(modal.get_by_text("제목을 입력하세요.", exact=True)).to_be_visible()
        title.fill("가" * 121)
        expect(apply).to_be_disabled()
        title.fill("가" * 120)
        expect(apply).to_be_enabled()
        modal.get_by_label("설명", exact=True).fill("나" * 5001)
        expect(apply).to_be_disabled()
        modal.get_by_label("설명", exact=True).fill("나" * 5000)
        expect(apply).to_be_enabled()
        for status in ("ACCEPTED", "DEFERRED"):
            modal.get_by_label("결정 상태", exact=True).select_option(status)
            modal.get_by_label("결정 사유", exact=False).fill("   ")
            expect(apply).to_be_disabled()
            modal.get_by_label("결정 사유", exact=False).fill("사유")
            expect(apply).to_be_enabled()
        modal.get_by_role("button", name="취소", exact=True).click()
        page.wait_for_timeout(600)
        assert idea_editor["read"]() == before
    finally:
        ctx.close()


@pytest.mark.parametrize("label,status", [("채택", "ACCEPTED"), ("보류", "DEFERRED")])
def test_quick_decision_requires_reason_before_applying(idea_editor, label, status):
    """TC-IDEA-02: 빠른 결정은 모달 확인 전까지 공유 문서를 바꾸지 않는다."""
    ctx, page = idea_editor["open"]()
    try:
        before = idea_editor["read"]()
        page.get_by_role("button", name=label, exact=True).first.click()
        modal = page.get_by_role("dialog")
        expect(modal.get_by_label("결정 상태", exact=True)).to_have_value(status)
        expect(modal.get_by_label("결정 사유", exact=False)).to_be_focused()
        expect(modal.get_by_role("button", name="적용", exact=True)).to_be_disabled()
        page.wait_for_timeout(500)
        assert idea_editor["read"]() == before
        modal.get_by_role("button", name="취소", exact=True).click()
        page.get_by_role("button", name=label, exact=True).first.click()
        modal.get_by_label("결정 사유", exact=False).fill("팀 검토 결과")
        modal.get_by_role("button", name="적용", exact=True).click()
        applied(page)
        card = idea_editor["read"]()["payload"]["ideas"][0]
        assert card["decisionStatus"] == status and card["decisionReason"] == "팀 검토 결과"
    finally:
        ctx.close()


def test_modal_preserves_remote_fields_while_editing(idea_editor):
    """TC-IDEA-01: 열린 모달에서 수정하지 않은 팀원 필드를 되돌리지 않는다."""
    first, page = idea_editor["open"]()
    second, other = idea_editor["open"]("auth-b")
    try:
        mine = edit(page)
        mine.get_by_label("제목 (필수)", exact=True).fill("내가 편집한 제목")
        theirs = edit(other)
        theirs.get_by_label("설명", exact=True).fill("팀원이 편집한 설명")
        theirs.get_by_role("button", name="적용", exact=True).click()
        applied(other)
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_contain_text(f'v{idea_editor["read"]()["version"]}', timeout=15000)
        mine.get_by_role("button", name="적용", exact=True).click()
        applied(page)
        card = idea_editor["read"]()["payload"]["ideas"][0]
        assert card["title"] == "내가 편집한 제목" and card["description"] == "팀원이 편집한 설명"
    finally:
        first.close()
        second.close()


def test_mobile_modal_is_scrollable_and_does_not_apply_on_escape(idea_editor):
    """TC-IDEA-01: 작은 화면에서도 적용/취소에 접근하고 Escape로 취소한다."""
    ctx, page = idea_editor["open"](viewport={"width": 390, "height": 844})
    try:
        before = idea_editor["read"]()
        modal = edit(page)
        modal.get_by_label("제목 (필수)", exact=True).fill("취소할 제목")
        expect(modal.get_by_role("button", name="적용", exact=True)).to_be_in_viewport()
        assert modal.bounding_box()["width"] <= 390
        page.screenshot(path=str(ROOT / ".local/w07a-mobile.png"))
        page.keyboard.press("Escape")
        expect(modal).to_have_count(0)
        assert idea_editor["read"]() == before
    finally:
        ctx.close()
