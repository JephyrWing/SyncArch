"""W08: TC-ARCH-01/02 and architecture portion of TC-SAFE-01, real React/API/SQL."""
from pathlib import Path
import re
from uuid import uuid4

from playwright.sync_api import expect

from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in
from test_documents_browser import save_request
from test_projects_browser import api

TITLE = "W08 architecture regression"


def document(setup, pid):
    result = api(setup, "GET", f"/api/projects/{pid}/document")
    assert result["status"] == 200
    return result["data"]


def enter(page, origin):
    page.goto(origin + "/")
    page.get_by_role("button", name=TITLE).click()
    page.get_by_role("button", name="Step 3. 시스템 아키텍처", exact=True).click()
    expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible()


def fixture(context, origin):
    setup = open_page(context, origin)
    sign_in(setup)
    pid = api(setup, "POST", "/api/projects", {"title": TITLE})["data"]["id"]
    assert api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})["status"] == 200
    request = save_request(document(setup, pid))
    nodes = [{"id": str(uuid4()), "name": name, "category": "Service", "techStack": ["Flask"],
              "assignedTeam": "Backend", "description": "initial", "x": 60 + i * 240, "y": 120}
             for i, name in enumerate(["Node A", "Node B", "Node C"])]
    connections = [{"id": str(uuid4()), "sourceId": nodes[i]["id"], "targetId": nodes[i + 1]["id"],
                    "protocol": "REST", "label": f"Link {i}", "description": "initial"} for i in range(2)]
    request["payload"].update(nodes=nodes, connections=connections)
    assert api(setup, "PUT", f"/api/projects/{pid}/document", request)["status"] == 200
    page = context.new_page()
    enter(page, origin)
    return page, setup, pid, nodes, connections


def node_row(page, name):
    return page.get_by_title("더블클릭하여 노드 속성 수정", exact=True).filter(has_text=name)


def edit_node(page, name):
    node_row(page, name).dblclick()
    return page.locator("form").filter(has=page.get_by_role("button", name="속성 저장 (ID 보존)"))


def saved_edit(page, action):
    with page.expect_response(lambda r: "/document" in r.url and r.request.method == "PUT" and r.status == 200):
        action()
    expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible()


def test_architecture_node_edit_drag_cancel_and_reload(browser_session):
    """TC-ARCH-01: actual modal, drag, SQL readback, reload, cancel and empty-name guard."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, nodes, connections = fixture(context, origin)
        form = edit_node(page, "Node A")
        form.locator("input").nth(0).fill(" ")
        expect(form.get_by_role("button", name="속성 저장 (ID 보존)")).to_be_disabled()
        form.locator("input").nth(0).fill("cancelled")
        form.get_by_role("button", name="취소", exact=True).click()
        expect(node_row(page, "Node A")).to_be_visible()
        form = edit_node(page, "Node A")
        form.locator("input").nth(0).fill("Saved node")
        form.locator("input").nth(1).fill("React, Vite")
        form.locator("textarea").fill("saved responsibility")
        saved_edit(page, lambda: form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        canvas_node = page.get_by_title("더블클릭하여 노드 속성(이름, 역할설명, 기술스택, 조직) 수정").filter(has_text="Saved node")
        box = canvas_node.bounding_box()
        page.mouse.move(box["x"] + 30, box["y"] + 35)
        page.mouse.down()
        saved_edit(page, lambda: (page.mouse.move(box["x"] + 110, box["y"] + 85, steps=5), page.mouse.up()))
        stored = document(setup, pid)["payload"]
        node = next(n for n in stored["nodes"] if n["id"] == nodes[0]["id"])
        assert (node["name"], node["description"], node["techStack"]) == ("Saved node", "saved responsibility", ["React", "Vite"])
        assert (node["x"], node["y"]) == (140, 170)
        assert stored["connections"] == connections
        enter(page, origin)
        form = edit_node(page, "Saved node")
        expect(form.locator("textarea")).to_have_value("saved responsibility")
        form.get_by_role("button", name="취소", exact=True).click()
        expect(canvas_node).to_have_css("left", "140px")
        expect(canvas_node).to_have_css("top", "170px")
    finally:
        context.close()


def test_architecture_connection_edit_delete_and_reference_guards(browser_session):
    """TC-ARCH-02/SAFE-01: direction/details persist; deleted node removes only its own lines."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, nodes, connections = fixture(context, origin)
        row = page.get_by_title("더블클릭하여 연결선 속성 수정", exact=True).filter(has_text="Link 0")
        row.dblclick()
        form = page.locator("form").filter(has=page.get_by_role("button", name="속성 저장 (ID 보존)"))
        form.locator("select").nth(1).select_option(nodes[0]["id"])
        expect(form.get_by_role("button", name="속성 저장 (ID 보존)")).to_be_disabled()
        form.locator("select").nth(0).select_option(nodes[1]["id"])
        form.locator("select").nth(2).select_option("WebSocket")
        form.locator("input").fill("Saved link")
        form.locator("textarea").fill("saved protocol details")
        saved_edit(page, lambda: form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        enter(page, origin)
        page.get_by_title("더블클릭하여 연결선 속성 수정", exact=True).filter(has_text="Saved link").dblclick()
        expect(form.locator("textarea")).to_have_value("saved protocol details")
        form.get_by_role("button", name="취소", exact=True).click()
        stored = document(setup, pid)
        connection = stored["payload"]["connections"][0]
        assert connection == {**connections[0], "sourceId": nodes[1]["id"], "targetId": nodes[0]["id"],
                              "protocol": "WebSocket", "label": "Saved link", "description": "saved protocol details"}
        bad = save_request(stored)
        bad["payload"]["connections"][0]["targetId"] = str(uuid4())
        assert api(setup, "PUT", f"/api/projects/{pid}/document", bad)["status"] == 422
        assert document(setup, pid)["version"] == stored["version"]
        saved_edit(page, lambda: node_row(page, "Node A").get_by_title("노드 삭제", exact=True).click())
        enter(page, origin)
        expect(node_row(page, "Node A")).to_have_count(0)
        stored = document(setup, pid)["payload"]
        assert stored["nodes"] == nodes[1:]
        assert stored["connections"] == [connections[1]]
    finally:
        context.close()


def test_architecture_two_accounts_merge_modal_fields_and_delete_edit(browser_session):
    """TC-ARCH-01/02: remote poll, concurrent modal edit, delete-versus-edit preserves edited node."""
    browser, origin = browser_session
    owner_context = browser.new_context(viewport={"width": 1600, "height": 1000})
    editor_context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        owner, setup, pid, nodes, _ = fixture(owner_context, origin)
        auth = open_page(editor_context, origin)
        sign_in(auth, "auth-b")
        editor = editor_context.new_page()
        enter(editor, origin)
        editor_form = edit_node(editor, "Node A")
        editor_form.locator("textarea").fill("editor responsibility")
        owner_form = edit_node(owner, "Node A")
        owner_form.locator("input").nth(0).fill("Owner name")
        saved_edit(owner, lambda: owner_form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        expect(node_row(editor, "Owner name")).to_be_visible(timeout=10000)
        saved_edit(editor, lambda: editor_form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        expect(node_row(owner, "Owner name")).to_be_visible(timeout=10000)
        current = document(setup, pid)["payload"]["nodes"][0]
        assert current["name"] == "Owner name" and current["description"] == "editor responsibility"
        owner.get_by_title("더블클릭하여 연결선 속성 수정", exact=True).filter(has_text="Link 0").dblclick()
        link_form = owner.locator("form").filter(has=owner.get_by_role("button", name="속성 저장 (ID 보존)"))
        link_form.locator("input").fill("Remote link")
        saved_edit(owner, lambda: link_form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        expect(editor.get_by_title("더블클릭하여 연결선 속성 수정", exact=True).filter(has_text="Remote link")).to_be_visible(timeout=10000)
        # Hold the editor's write so the owner's delete really races a local edit.
        held = []
        editor.route(f"**/api/projects/{pid}/document", lambda route: held.append(route)
                     if route.request.method == "PUT" else route.continue_())
        form = edit_node(editor, "Owner name")
        form.locator("input").nth(0).fill("Preserved edit")
        form.get_by_role("button", name="속성 저장 (ID 보존)").click()
        expect(editor.get_by_role("status").filter(has_text="저장 중")).to_be_visible()
        editor.wait_for_timeout(500)
        assert len(held) == 1
        saved_edit(owner, lambda: node_row(owner, "Owner name").get_by_title("노드 삭제", exact=True).click())
        held.pop().continue_()
        editor.unroute(f"**/api/projects/{pid}/document")
        expect(editor.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=15000)
        expect(node_row(owner, "Preserved edit")).to_be_visible(timeout=10000)
        stored = document(setup, pid)["payload"]
        assert any(n["id"] == nodes[0]["id"] and n["name"] == "Preserved edit" for n in stored["nodes"])
        ids = {n["id"] for n in stored["nodes"]}
        assert all(c["sourceId"] in ids and c["targetId"] in ids for c in stored["connections"])
        enter(editor, origin)
        expect(node_row(editor, "Preserved edit")).to_be_visible()
    finally:
        owner_context.close()
        editor_context.close()


def test_architecture_unsupported_version_controls_are_not_exposed(browser_session):
    """W08 scope: neither fresh nor legacy projects may restore or save unsupported snapshots."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, _, _ = fixture(context, origin)
        for legacy in (False, True):
            if legacy:
                template = api(setup, "GET", "/api/project-templates")["data"][0]
                # A disposable test fixture only, never a copy of a real user's project.
                api(setup, "PATCH", f"/api/projects/{pid}/archive", {"archived": True})
                pid = api(setup, "POST", f'/api/project-templates/{template["id"]}/clone',
                          {"sourceVersion": template["version"], "title": TITLE})["data"]["id"]
                enter(page, origin)
            expect(page.get_by_role("button", name="버전 저장", exact=True)).to_have_count(0)
            expect(page.get_by_role("button", name="히스토리", exact=True)).to_have_count(0)
            expect(page.get_by_text("아키텍처 버전:", exact=True)).to_have_count(0)
            expect(page.get_by_title("단계 잠금은 현재 지원하지 않습니다", exact=True)).to_be_disabled()
        page.screenshot(path=str(Path(__file__).resolve().parents[2] / ".local/w08-architecture-ui.png"))
    finally:
        context.close()


def test_architecture_create_node_and_connection_with_product_forms(browser_session):
    """TC-ARCH-01/02: new UUID items created through the UI survive fresh document load."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, nodes, _ = fixture(context, origin)
        page.get_by_role("button", name="노드 추가", exact=True).click()
        page.get_by_placeholder("예: Notification Worker").fill("Created node")
        page.get_by_placeholder("예: Node.js, BullMQ, FCM").fill("Python, Redis")
        page.get_by_placeholder("컴포넌트의 핵심 책임 기술...").fill("created responsibility")
        saved_edit(page, lambda: page.get_by_role("button", name="노드 생성", exact=True).click())
        created = next(n for n in document(setup, pid)["payload"]["nodes"] if n["name"] == "Created node")
        assert created["description"] == "created responsibility" and created["techStack"] == ["Python", "Redis"]
        page.get_by_role("button", name="연결선", exact=True).click()
        form = page.locator("form").filter(has=page.get_by_role("button", name="연결선 등록", exact=True))
        form.locator("select").nth(0).select_option(created["id"])
        form.locator("select").nth(1).select_option(nodes[0]["id"])
        form.locator("input").nth(0).fill("Created link")
        form.locator("input").nth(1).fill("created details")
        saved_edit(page, lambda: form.get_by_role("button", name="연결선 등록", exact=True).click())
        before = document(setup, pid)["payload"]
        enter(page, origin)
        expect(node_row(page, "Created node")).to_be_visible()
        expect(page.get_by_title("더블클릭하여 연결선 속성 수정", exact=True).filter(has_text="Created link")).to_be_visible()
        assert document(setup, pid)["payload"] == before
    finally:
        context.close()


def test_architecture_optional_step_follow_is_personal_and_releasable(browser_session):
    """W08 remaining acceptance: two real accounts follow Steps without saving/locking the design."""
    browser, origin = browser_session
    owner_context = browser.new_context(viewport={"width": 1600, "height": 1000})
    editor_context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        owner, setup, pid, _, _ = fixture(owner_context, origin)
        auth = open_page(editor_context, origin)
        sign_in(auth, "auth-b")
        editor = editor_context.new_page()
        enter(editor, origin)
        before = document(setup, pid)
        teammate = owner.get_by_title(re.compile("검증 B.*이 사람 화면 따라가기"))
        expect(teammate).to_be_enabled(timeout=10000)
        teammate.click()
        expect(owner.get_by_text("검증 B 따라가는 중", exact=True)).to_be_visible()
        editor.get_by_role("button", name="Step 2. 기능·API 명세", exact=True).click()
        expect(owner.get_by_title(re.compile("검증 B.*Step 2.*따라가기 끄기"))).to_be_visible(timeout=10000)
        expect(owner.get_by_text("현재 아키텍처", exact=True)).to_have_count(0)
        owner.get_by_title(re.compile("검증 B.*따라가기 끄기")).click()
        expect(owner.get_by_text("검증 B 따라가는 중", exact=True)).to_have_count(0)
        owner.get_by_role("button", name="Step 3. 시스템 아키텍처", exact=True).click()
        expect(owner.get_by_text("현재 아키텍처", exact=True)).to_be_visible()
        editor.get_by_role("button", name="Step 1. 아이디어 보드", exact=True).click()
        expect(owner.get_by_title(re.compile("검증 B.*Step 1"))).to_be_visible(timeout=10000)
        expect(owner.get_by_text("현재 아키텍처", exact=True)).to_be_visible()
        assert document(setup, pid)["version"] == before["version"]
        assert document(setup, pid)["payload"] == before["payload"]
    finally:
        owner_context.close()
        editor_context.close()
