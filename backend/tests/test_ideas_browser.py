"""W07A: 실제 React 편집·취소·검증과 Flask 저장/두 계정 회귀입니다."""
from pathlib import Path
from uuid import uuid4
from uuid import UUID

import pytest
from playwright.sync_api import expect
from sqlalchemy import event
from sqlalchemy.engine import make_url

from app import create_app
from app.extensions import db

from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def app(app, tmp_path):
    # 동시 브라우저 요청이 메모리 SQLite의 단일 연결/트랜잭션을 공유하지 않게 합니다.
    if make_url(app.config["SQLALCHEMY_DATABASE_URI"]).get_backend_name() != "sqlite":
        yield app
        return
    isolated = create_app({**app.config, "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "ideas.sqlite").as_posix()})
    with isolated.app_context():
        @event.listens_for(db.engine, "connect")
        def enforce_foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield isolated
    finally:
        with isolated.app_context():
            db.session.remove()
            db.engine.dispose()


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
    document["payload"]["features"] = [{"id": str(uuid4()), "name": "원본 연결 기능", "relatedStoryId": ids[2]}]
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
        page.get_by_role("tab", name="주요 사용자 역할(Actor)", exact=False).click()
        modal = edit(page)
        expect(modal.get_by_label("제목 (필수)", exact=True)).to_have_value("수정한 아이디어")
        expect(modal.get_by_label("설명", exact=True)).to_have_value("변경한 설명")
        expect(modal.get_by_label("분류", exact=True)).to_have_value("actors")
        expect(modal.get_by_label("결정 사유", exact=False)).to_have_value("사용자 검증을 마쳐 채택")
        modal.get_by_role("button", name="취소", exact=True).click()
        page.get_by_role("region", name="아이디어 가로 트리").get_by_role("button", name="수정한 아이디어 하위 펼치기", exact=True).click()
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


def tree_node(page, idea_id):
    return page.locator(f'[data-idea-node="{idea_id}"]')


def create_derived(idea_editor, page, parent_id, title):
    tree_node(page, parent_id).get_by_role("button", name="파생 아이디어", exact=True).click()
    page.get_by_label("새 아이디어 제목", exact=True).fill(title)
    page.get_by_role("button", name="아이디어 등록", exact=True).click()
    applied(page)
    cards = idea_editor["read"]()["payload"]["ideas"]
    return next(card for card in cards if card["title"] == title)


def save_owner_payload(editor, document):
    response = editor["client"].put(editor["url"], headers=editor["headers"], json={
        "baseVersion": document["version"], "mutationId": str(uuid4()),
        "project": {"title": "W07A 화면 검증"}, "payload": document["payload"],
    })
    assert response.status_code == 200


def test_tree_expansion_edges_and_collapse_are_personal_and_do_not_save(idea_editor):
    """TC-IDEA-04/05: 직접 자식·연결선·형제 보기와 문서 저장 상태를 분리한다."""
    first, page = idea_editor["open"](viewport={"width": 1920, "height": 1080})
    second, other = idea_editor["open"]("auth-b")
    puts = []
    page.on("request", lambda request: puts.append(request.url) if request.method == "PUT" and request.url.endswith("/document") else None)
    try:
        before = idea_editor["read"]()
        root, child, grandchild, different = idea_editor["ids"]
        expect(tree_node(page, root)).to_be_visible()
        expect(tree_node(page, child)).to_have_count(0)
        expect(tree_node(page, different)).to_have_count(0)
        tree_node(page, root).get_by_role("button", name="원본 아이디어 하위 펼치기", exact=True).click()
        expect(tree_node(page, child)).to_be_visible()
        expect(tree_node(page, grandchild)).to_have_count(0)
        tree_node(page, child).get_by_role("button", name="자식 아이디어 하위 펼치기", exact=True).focus()
        page.keyboard.press("Enter")
        expect(tree_node(page, grandchild)).to_be_visible()
        expect(page.locator("[data-idea-edge]")).to_have_count(2)
        boxes = [tree_node(page, idea_id).bounding_box() for idea_id in (root, child, grandchild)]
        assert boxes[0]["x"] + boxes[0]["width"] < boxes[1]["x"]
        assert boxes[1]["x"] + boxes[1]["width"] < boxes[2]["x"]
        page.screenshot(path=str(ROOT / ".local/w07a-tree-desktop.png"))
        expect(tree_node(other, child)).to_have_count(0)
        page.get_by_role("tab", name="기술적 제약", exact=False).click()
        expect(tree_node(page, different)).to_be_visible()
        expect(tree_node(other, root)).to_be_visible()
        page.get_by_role("tab", name="핵심 문제", exact=False).click()
        tree_node(page, root).get_by_role("button", name="원본 아이디어 하위 접기", exact=True).click()
        expect(tree_node(page, child)).to_have_count(0)
        tree_node(page, root).get_by_role("button", name="원본 아이디어 하위 펼치기", exact=True).click()
        expect(tree_node(page, child)).to_be_visible()
        expect(tree_node(page, grandchild)).to_have_count(0)
        page.wait_for_timeout(1200)
        assert not puts and idea_editor["read"]() == before
    finally:
        first.close()
        second.close()


def test_derived_creation_keeps_uuid_parent_order_actor_and_reload(idea_editor):
    """TC-IDEA-04: 실제 폼으로 세 단계 이상 추가하고 UUID·관계·분류를 보존한다."""
    ctx, page = idea_editor["open"]("auth-b")
    try:
        root = idea_editor["ids"][0]
        child = create_derived(idea_editor, page, root, "새 파생 카드")
        grandchild = create_derived(idea_editor, page, child["id"], "새 손자 카드")
        great = create_derived(idea_editor, page, grandchild["id"], "새 증손자 카드")
        assert child["parentIdeaId"] == root and grandchild["parentIdeaId"] == child["id"]
        assert great["parentIdeaId"] == grandchild["id"]
        assert child["siblingOrder"] > idea_editor["read"]()["payload"]["ideas"][1]["siblingOrder"]
        for card in (child, grandchild, great):
            assert str(UUID(card["id"])) == card["id"]
            assert card["category"] == "problems_goals" and card["authorId"] != idea_editor["read"]()["payload"]["ideas"][0]["authorId"]
        node = tree_node(page, great["id"])
        node.get_by_title("팀원 +1 투표", exact=True).click()
        applied(page)
        node.get_by_role("button", name="댓글 (0)", exact=True).click()
        node.get_by_placeholder("코멘트 남기기...").fill("파생 카드 댓글")
        node.get_by_role("button", name="등록", exact=True).click()
        applied(page)
        node.get_by_role("button", name="채택", exact=True).click()
        modal = page.get_by_role("dialog", name="아이디어 수정")
        expect(modal.get_by_role("button", name="적용", exact=True)).to_be_disabled()
        modal.get_by_label("결정 사유", exact=False).fill("파생 검토 완료")
        modal.get_by_role("button", name="적용", exact=True).click()
        applied(page)
        recorded = next(card for card in idea_editor["read"]()["payload"]["ideas"] if card["id"] == great["id"])
        assert not recorded["voterIds"]
        assert recorded["comments"][0]["authorId"] == great["authorId"]
        assert recorded["decisionStatus"] == "ACCEPTED" and recorded["decidedBy"] == great["authorId"]
        before = idea_editor["read"]()
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        expect(tree_node(page, child["id"])).to_have_count(0)
        tree_node(page, root).get_by_role("button", name="원본 아이디어 하위 펼치기", exact=True).click()
        for card in (child, grandchild):
            tree_node(page, card["id"]).get_by_role("button", name=f'{card["title"]} 하위 펼치기', exact=True).click()
        expect(tree_node(page, great["id"])).to_be_visible()
        assert idea_editor["read"]() == before
    finally:
        ctx.close()


def test_category_and_parent_switches_preserve_unsaved_drafts(idea_editor):
    """TC-IDEA-05: 탭/부모별 미저장 입력은 개인 상태이고 기존 모달을 유지한다."""
    ctx, page = idea_editor["open"]()
    try:
        before = idea_editor["read"]()
        title = page.get_by_label("새 아이디어 제목", exact=True)
        title.fill("루트 임시 제목")
        page.get_by_role("tab", name="주요 사용자", exact=False).click()
        title.fill("역할 임시 제목")
        page.get_by_role("tab", name="핵심 문제", exact=False).click()
        expect(title).to_have_value("루트 임시 제목")
        tree_node(page, idea_editor["ids"][0]).get_by_role("button", name="파생 아이디어", exact=True).click()
        title.fill("파생 임시 제목")
        page.get_by_role("tab", name="기술적 제약", exact=False).click()
        page.get_by_role("tab", name="핵심 문제", exact=False).click()
        expect(title).to_have_value("루트 임시 제목")
        tree_node(page, idea_editor["ids"][0]).get_by_role("button", name="파생 아이디어", exact=True).click()
        expect(title).to_have_value("파생 임시 제목")
        modal = edit(page)
        modal.get_by_label("제목 (필수)", exact=True).fill("취소할 편집")
        page.keyboard.press("Escape")
        expect(title).to_have_value("파생 임시 제목")
        assert idea_editor["read"]() == before
    finally:
        ctx.close()


def test_tree_delete_confirms_impact_and_clears_feature_references_atomically(idea_editor):
    """TC-IDEA-04/SAFE-01: 기본 취소와 하위·댓글/표·기능 참조의 원자 삭제를 확인한다."""
    ctx, page = idea_editor["open"]()
    try:
        before = idea_editor["read"]()
        page.get_by_title("삭제", exact=True).first.click()
        modal = page.get_by_role("dialog", name="아이디어 삭제 영향 확인")
        expect(modal.get_by_role("button", name="취소", exact=True)).to_be_focused()
        expect(modal).to_contain_text("아이디어 3개(하위 2개), 댓글 1개, 투표 1개")
        expect(modal).to_contain_text("연결 기능 1개")
        modal.get_by_role("button", name="취소", exact=True).click()
        assert idea_editor["read"]() == before
        page.get_by_title("삭제", exact=True).first.click()
        modal.get_by_role("button", name="하위 포함 삭제", exact=True).click()
        applied(page)
        after = idea_editor["read"]()
        assert after["version"] == before["version"] + 1
        assert [card["id"] for card in after["payload"]["ideas"]] == [idea_editor["ids"][3]]
        assert after["payload"]["features"][0]["id"] == before["payload"]["features"][0]["id"]
        assert not after["payload"]["features"][0]["relatedStoryId"]
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        page.get_by_role("tab", name="기술적 제약", exact=False).click()
        expect(tree_node(page, idea_editor["ids"][3])).to_be_visible()
        assert idea_editor["read"]() == after
    finally:
        ctx.close()


def test_removed_parent_preserves_draft_and_blocks_submission(idea_editor):
    """TC-IDEA-04: 원격 부모 삭제를 루트 생성으로 잘못 전환하지 않는다."""
    ctx, page = idea_editor["open"]()
    try:
        tree_node(page, idea_editor["ids"][0]).get_by_role("button", name="파생 아이디어", exact=True).click()
        page.get_by_label("새 아이디어 제목", exact=True).fill("보존할 파생 초안")
        document = idea_editor["read"]()
        document["payload"]["ideas"] = document["payload"]["ideas"][3:]
        document["payload"]["features"][0]["relatedStoryId"] = ""
        save_owner_payload(idea_editor, document)
        expect(page.get_by_text("부모가 삭제되었습니다.", exact=False)).to_be_visible(timeout=15000)
        expect(page.get_by_role("button", name="아이디어 등록", exact=True)).to_be_disabled()
        expect(page.get_by_label("새 아이디어 제목", exact=True)).to_have_value("보존할 파생 초안")
        assert len(idea_editor["read"]()["payload"]["ideas"]) == 1
    finally:
        ctx.close()


def test_delete_impact_must_be_reviewed_again_after_remote_change(idea_editor):
    """TC-IDEA-04: 확인 중 하위 카드가 추가되면 다시 확인하기 전 삭제를 막는다."""
    ctx, page = idea_editor["open"]()
    try:
        page.get_by_title("삭제", exact=True).first.click()
        modal = page.get_by_role("dialog", name="아이디어 삭제 영향 확인")
        document = idea_editor["read"]()
        document["payload"]["ideas"].append({"id": str(uuid4()), "title": "뒤늦은 자식", "category": "problems_goals", "parentIdeaId": idea_editor["ids"][0]})
        save_owner_payload(idea_editor, document)
        expect(modal.get_by_role("button", name="최신 영향 다시 확인", exact=True)).to_be_visible(timeout=15000)
        expect(modal.get_by_role("button", name="하위 포함 삭제", exact=True)).to_be_disabled()
        expect(modal).to_contain_text("아이디어 4개(하위 3개)")
        modal.get_by_role("button", name="최신 영향 다시 확인", exact=True).click()
        expect(modal.get_by_role("button", name="하위 포함 삭제", exact=True)).to_be_enabled()
        modal.get_by_role("button", name="취소", exact=True).click()
        assert len(idea_editor["read"]()["payload"]["ideas"]) == 5
    finally:
        ctx.close()


def test_remote_parent_category_is_inherited_without_losing_creation_draft(idea_editor):
    """TC-IDEA-04/05: 등록 중인 부모가 이동해도 최신 분류를 상속한다."""
    first, page = idea_editor["open"]("auth-b")
    second, other = idea_editor["open"]()
    try:
        root = idea_editor["ids"][0]
        tree_node(page, root).get_by_role("button", name="파생 아이디어", exact=True).click()
        page.get_by_label("새 아이디어 제목", exact=True).fill("이동 후 파생")
        modal = edit(other)
        modal.get_by_label("분류", exact=True).select_option("actors")
        modal.get_by_role("button", name="적용", exact=True).click()
        applied(other)
        expect(page.get_by_text("분류: 주요 사용자 역할(Actor) (부모 상속)", exact=True)).to_be_visible(timeout=15000)
        expect(page.get_by_label("새 아이디어 제목", exact=True)).to_have_value("이동 후 파생")
        page.get_by_role("button", name="아이디어 등록", exact=True).click()
        applied(page)
        card = next(card for card in idea_editor["read"]()["payload"]["ideas"] if card["title"] == "이동 후 파생")
        assert card["category"] == "actors" and card["parentIdeaId"] == root
        expect(tree_node(page, card["id"])).to_be_visible()
    finally:
        first.close()
        second.close()


def test_mobile_tree_scroll_and_derived_form_reuse(idea_editor):
    """TC-IDEA-04/05: 작은 화면에서 가로 스크롤과 파생 폼을 왕복한다."""
    ctx, page = idea_editor["open"](viewport={"width": 390, "height": 844})
    try:
        page.get_by_role("button", name="의사결정 캔버스", exact=True).click()
        root = idea_editor["ids"][0]
        tree_node(page, root).get_by_role("button", name="원본 아이디어 하위 펼치기", exact=True).click()
        region = page.get_by_role("region", name="아이디어 가로 트리")
        assert region.evaluate("element => element.scrollWidth > element.clientWidth")
        tree_node(page, root).get_by_role("button", name="파생 아이디어", exact=True).click()
        expect(page.get_by_label("새 아이디어 제목", exact=True)).to_be_visible()
        page.get_by_label("새 아이디어 제목", exact=True).fill("모바일 파생")
        page.get_by_role("button", name="아이디어 등록", exact=True).click()
        applied(page)
        created = next(card for card in idea_editor["read"]()["payload"]["ideas"] if card["title"] == "모바일 파생")
        expect(tree_node(page, created["id"])).to_be_visible()
        tree_node(page, created["id"]).get_by_role("button", name="모바일 파생 하위 펼치기", exact=True).scroll_into_view_if_needed()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.screenshot(path=str(ROOT / ".local/w07a-tree-mobile.png"))
    finally:
        ctx.close()


def test_title_only_root_create_edit_delete_survives_reload(idea_editor):
    """TC-IDEA-01: 제목만 루트 생성→같은 UUID 편집→삭제를 실제 폼에서 확인한다."""
    ctx, page = idea_editor["open"]("auth-b")
    try:
        before = idea_editor["read"]()
        page.get_by_label("새 아이디어 제목", exact=True).fill("제목만 루트")
        page.get_by_role("button", name="아이디어 등록", exact=True).click()
        applied(page)
        created = next(card for card in idea_editor["read"]()["payload"]["ideas"] if card["title"] == "제목만 루트")
        assert str(UUID(created["id"])) == created["id"]
        assert created["parentIdeaId"] is None and created["description"] == ""
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        node = tree_node(page, created["id"])
        expect(node).to_be_visible()
        node.get_by_role("button", name="수정", exact=True).click()
        modal = page.get_by_role("dialog", name="아이디어 수정")
        modal.get_by_label("제목 (필수)", exact=True).fill("수정한 루트")
        modal.get_by_role("button", name="적용", exact=True).click()
        applied(page)
        assert next(card for card in idea_editor["read"]()["payload"]["ideas"] if card["id"] == created["id"])["title"] == "수정한 루트"
        page.get_by_title("삭제", exact=True).last.click()
        page.get_by_role("dialog", name="아이디어 삭제 영향 확인").get_by_role("button", name="하위 포함 삭제", exact=True).click()
        applied(page)
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        expect(tree_node(page, created["id"])).to_have_count(0)
        assert idea_editor["read"]()["payload"]["ideas"] == before["payload"]["ideas"]
    finally:
        ctx.close()


def test_two_accounts_vote_comment_and_tab_drafts_preserve_identity(idea_editor):
    """TC-IDEA-03/AUTH-02: 겹친 투표·댓글 저장과 개인 댓글 초안을 확인한다."""
    first, page = idea_editor["open"]()
    second, other = idea_editor["open"]("auth-b")
    try:
        root, _, _, different = idea_editor["ids"]
        original = idea_editor["read"]()["payload"]["ideas"][0]
        a, b = tree_node(page, root), tree_node(other, root)
        a.get_by_title("팀원 +1 투표", exact=True).click()
        applied(page)
        expect(b.get_by_title("팀원 +1 투표", exact=True)).to_contain_text("+0", timeout=15000)
        b.get_by_title("팀원 +1 투표", exact=True).click()
        a.get_by_title("팀원 +1 투표", exact=True).click()
        expect(a.get_by_title("팀원 +1 투표", exact=True)).to_contain_text("+2", timeout=15000)
        expect(b.get_by_title("팀원 +1 투표", exact=True)).to_contain_text("+2", timeout=15000)
        voted = idea_editor["read"]()["payload"]["ideas"][0]
        assert len(set(voted["voterIds"])) == len(voted["voterIds"]) == 2
        a.get_by_title("팀원 +1 투표", exact=True).click()
        b.get_by_title("팀원 +1 투표", exact=True).click()
        expect(a.get_by_title("팀원 +1 투표", exact=True)).to_contain_text("+0", timeout=15000)
        expect(b.get_by_title("팀원 +1 투표", exact=True)).to_contain_text("+0", timeout=15000)
        a.get_by_role("button", name="댓글 (1)", exact=True).click()
        a.get_by_placeholder("코멘트 남기기...").fill("A 댓글 초안")
        page.get_by_role("tab", name="기술적 제약", exact=False).click()
        tree_node(page, different).get_by_role("button", name="댓글 (0)", exact=True).click()
        expect(tree_node(page, different).get_by_placeholder("코멘트 남기기...")).to_have_value("")
        page.get_by_role("tab", name="핵심 문제", exact=False).click()
        a.get_by_role("button", name="댓글 (1)", exact=True).click()
        expect(a.get_by_placeholder("코멘트 남기기...")).to_have_value("A 댓글 초안")
        b.get_by_role("button", name="댓글 (1)", exact=True).click()
        b.get_by_placeholder("코멘트 남기기...").fill("B 댓글")
        a.get_by_role("button", name="등록", exact=True).click()
        b.get_by_role("button", name="등록", exact=True).click()
        expect(a.get_by_role("button", name="댓글 (3)", exact=True)).to_be_visible(timeout=15000)
        expect(b.get_by_role("button", name="댓글 (3)", exact=True)).to_be_visible(timeout=15000)
        card = idea_editor["read"]()["payload"]["ideas"][0]
        assert not card["voterIds"] and card["authorId"] == original["authorId"]
        comments = {comment["text"]: comment for comment in card["comments"]}
        assert comments["A 댓글 초안"]["authorId"] == original["authorId"]
        assert comments["B 댓글"]["authorId"] != original["authorId"]
        assert all(comments[text]["createdAt"].endswith("Z") for text in ("A 댓글 초안", "B 댓글"))
        page.reload()
        page.get_by_role("button", name="W07A 화면 검증", exact=False).click()
        expect(tree_node(page, root).get_by_role("button", name="댓글 (3)", exact=True)).to_be_visible()
        assert idea_editor["read"]()["payload"]["ideas"][0] == card
    finally:
        first.close()
        second.close()
