"""W08 design: panel preference, explicit editing, fit/zoom/drag with real API persistence."""
from pathlib import Path

from playwright.sync_api import expect

from test_architecture_browser import auth_app, browser_session, document, enter, fixture, saved_edit
from test_documents_browser import save_request
from test_projects_browser import api

ROOT = Path(__file__).resolve().parents[2]


def assert_nodes_fit(page):
    bounds = page.locator('[aria-label="아키텍처 캔버스"]').bounding_box()
    cards = page.locator('[data-arch-node]')
    assert cards.count() > 0
    for card in cards.all():
        box = card.bounding_box()
        assert box["x"] >= bounds["x"] - 1
        assert box["y"] >= bounds["y"] - 1
        assert box["x"] + box["width"] <= bounds["x"] + bounds["width"] + 1
        assert box["y"] + box["height"] <= bounds["y"] + bounds["height"] + 1


def test_architecture_panel_width_is_personal_persistent_and_step_specific(browser_session):
    """TC-ARCH-01: 30% default/reset, custom width after reload, no PUT or cross-Step preference overwrite."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, _, _ = fixture(context, origin)
        panel = page.locator('[aria-label="아키텍처 편집 패널"]')
        expect(panel).to_have_attribute("style", "width: 30%;")
        before = document(setup, pid)
        writes = []
        page.on("request", lambda request: writes.append(request.url)
                if request.method == "PUT" and "/document" in request.url else None)
        divider = page.get_by_title("드래그하여 사이드바 너비 조절 (더블클릭 시 30% 리셋)", exact=True)
        box = divider.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 100)
        page.mouse.down()
        page.mouse.move(box["x"] + 125, box["y"] + 100, steps=6)
        page.mouse.up()
        width = page.evaluate("localStorage.getItem('syncarch_architecture_sidebar_width')")
        assert float(width) > 30
        page.evaluate("localStorage.setItem('syncarch_sidebar_width', '48')")
        enter(page, origin)
        assert abs(float(panel.evaluate("el => el.style.width.slice(0,-1)")) - float(width)) < .01
        divider.dblclick()
        expect(panel).to_have_attribute("style", "width: 30%;")
        assert page.evaluate("localStorage.getItem('syncarch_sidebar_width')") == "48"
        assert document(setup, pid)["version"] == before["version"]
        assert writes == []
    finally:
        context.close()


def test_architecture_edit_buttons_keyboard_and_canvas_keep_id_and_position(browser_session):
    """TC-ARCH-01/02: visible buttons open existing forms; mouse down on canvas pencil never drags."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, nodes, connections = fixture(context, origin)
        edit = page.get_by_role("button", name="Node A 노드 편집", exact=True)
        edit.focus()
        edit.press("Enter")
        form = page.locator("form").filter(has=page.get_by_role("button", name="속성 저장 (ID 보존)"))
        form.locator("input").nth(0).fill("Pencil node")
        saved_edit(page, lambda: form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        before = document(setup, pid)
        page.get_by_role("button", name="Pencil node 캔버스 노드 편집", exact=True).click()
        expect(form.locator("input").nth(0)).to_have_value("Pencil node")
        form.get_by_role("button", name="취소", exact=True).click()
        page.get_by_role("button", name="Link 0 연결선 편집", exact=True).click()
        form.locator("textarea").fill("edited via pencil")
        saved_edit(page, lambda: form.get_by_role("button", name="속성 저장 (ID 보존)").click())
        stored = document(setup, pid)["payload"]
        assert stored["nodes"][0] == {**nodes[0], "name": "Pencil node"}
        assert stored["connections"][0] == {**connections[0], "description": "edited via pencil"}
        assert document(setup, pid)["version"] == before["version"] + 1
        enter(page, origin)
        page.get_by_role("button", name="Pencil node 노드 편집", exact=True).click()
        expect(form.locator("input").nth(0)).to_have_value("Pencil node")
    finally:
        context.close()


def test_architecture_fit_all_mobile_empty_and_drag_after_fit(browser_session):
    """TC-ARCH-01: actual card bounds fit, view-only actions keep version, drag uses inverse transform."""
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    try:
        page, setup, pid, _, _ = fixture(context, origin)
        request = save_request(document(setup, pid))
        request["payload"]["nodes"][0].update(x=20, y=20)
        request["payload"]["nodes"][2].update(x=1150, y=750, techStack=[f"Technology-{i}" for i in range(12)])
        assert api(setup, "PUT", f"/api/projects/{pid}/document", request)["status"] == 200
        last = page.locator('[data-arch-node]').last
        expect(last).to_have_css("left", "1150px", timeout=10000)
        before = document(setup, pid)
        fit = page.get_by_role("button", name="캔버스 전체 보기", exact=True)
        fit.click()
        assert_nodes_fit(page)
        for close in page.get_by_role("button", name="알림 닫기", exact=True).all():
            close.click()
        page.screenshot(path=str(ROOT / ".local/w08-design-desktop.png"))
        assert document(setup, pid)["payload"] == before["payload"]
        assert document(setup, pid)["version"] == before["version"]
        card = page.locator('[data-arch-node]').first
        box = card.bounding_box()
        zoom = card.evaluate("el => new DOMMatrix(getComputedStyle(el.parentElement).transform).a")
        page.mouse.move(box["x"] + 12, box["y"] + box["height"] / 2)
        page.mouse.down()
        saved_edit(page, lambda: (page.mouse.move(box["x"] + 52, box["y"] + box["height"] / 2 + 20, steps=5), page.mouse.up()))
        moved = document(setup, pid)
        assert abs(moved["payload"]["nodes"][0]["x"] - (20 + 40 / zoom)) <= 1
        assert abs(moved["payload"]["nodes"][0]["y"] - (20 + 20 / zoom)) <= 1
        assert moved["payload"]["nodes"][1:] == before["payload"]["nodes"][1:]
        assert moved["payload"]["connections"] == before["payload"]["connections"]
        page.get_by_title("확대", exact=True).click()
        page.get_by_title("축소", exact=True).click()
        page.get_by_title("배율 초기화", exact=True).click()
        assert card.evaluate("el => new DOMMatrix(getComputedStyle(el.parentElement).transform).a") == 1
        page.set_viewport_size({"width": 390, "height": 844})
        page.get_by_role("button", name="아키텍처 캔버스", exact=True).click()
        fit.click()
        assert_nodes_fit(page)
        for close in page.get_by_role("button", name="알림 닫기", exact=True).all():
            close.click()
        page.screenshot(path=str(ROOT / ".local/w08-design-mobile.png"))
        assert document(setup, pid)["version"] == moved["version"]
        empty = save_request(moved)
        empty["payload"].update(nodes=[], connections=[])
        assert api(setup, "PUT", f"/api/projects/{pid}/document", empty)["status"] == 200
        expect(fit).to_be_disabled(timeout=10000)
        expect(page.locator('[data-arch-node]')).to_have_count(0)
    finally:
        context.close()
