"""PR31: 실제 저장 화면의 폭별 헤더·모달 접근과 의도된 ERD 스크롤."""
from pathlib import Path
import re

import pytest
from playwright.sync_api import expect

from test_auth import auth_app  # noqa: F401
from test_auth_browser import browser_session
from test_erd_workspace_browser import erd_workspace, saved
from test_projects_browser import api
from test_workspace_browser import SUMMARY

ROOT = Path(__file__).resolve().parents[2]


def inside_viewport(locator, width, height):
    expect(locator).to_be_visible()
    box = locator.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0
    assert box["x"] >= -1 and box["x"] + box["width"] <= width + 1, box
    assert box["y"] >= -1 and box["y"] + box["height"] <= height + 1, box


@pytest.mark.parametrize("width", [360, 768, 1024, 1440, 1920])
def test_responsive_header_modals_save_export_and_internal_erd_scroll(browser_session, auth_app, width):
    browser, origin = browser_session
    # 운영에서 보이는 Google 연결 버튼까지 포함한다. 실제 provider 왕복 검사가 아니다.
    auth_app.config["GOOGLE_OAUTH_ENABLED"] = True
    height = 900
    context = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
    try:
        page, setup, url = erd_workspace(context, origin)
        for name in ["Step 1. 아이디어 보드", "Step 2. 기능·API 명세", "Step 3. 시스템 아키텍처", "Step 4. DB(ERD) 설계"]:
            button = page.get_by_role("button", name=name, exact=True)
            inside_viewport(button, width, height)
            button.click()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), name
        # 표가 화면보다 넓어도 외부 페이지는 넘치지 않고 표 안에서만 스크롤한다.
        table = page.locator("table").filter(has=page.get_by_label("id 컬럼명", exact=True))
        expect(table).to_be_visible()
        geometry = table.evaluate("el => ({table:el.scrollWidth, viewport:el.parentElement.clientWidth, overflow:getComputedStyle(el.parentElement).overflowX})")
        assert geometry["overflow"] in ("auto", "scroll")
        if width == 360:
            assert geometry["table"] > geometry["viewport"]

        for name in ["초대 코드", "이메일 등록/수정", "프로젝트 현황·활동 열기", "내보내기 (SQL / MD)"]:
            inside_viewport(page.get_by_role("button", name=name, exact=True), width, height)
        page.get_by_role("button", name="초대 코드", exact=True).click()
        code = page.locator("code").filter(has_text="-")
        expect(code).to_have_text(re.compile(r"[A-Z2-9]{4}-[A-Z2-9]{4}"))
        inside_viewport(page.get_by_role("button", name="코드 재발급", exact=True), width, height)
        page.get_by_role("button", name="닫기", exact=True).click()

        page.get_by_role("button", name="이메일 등록/수정", exact=True).click()
        dialog = page.get_by_role("dialog", name="이메일 등록/수정")
        inside_viewport(dialog, width, height)
        dialog.get_by_role("button", name="이메일 설정 닫기", exact=True).click()
        page.get_by_role("button", name="프로젝트 현황·활동 열기", exact=True).click()
        inside_viewport(page.get_by_role("dialog", name="프로젝트 현황·활동", exact=True), width, height)
        page.get_by_role("button", name="현황 닫기", exact=True).click()

        page.get_by_role("button", name="Step 1. 아이디어 보드", exact=True).click()
        before = api(setup, "GET", url)["data"]
        stored = saved(page, lambda: page.get_by_placeholder(SUMMARY).fill(f"responsive saved {width}"))
        assert stored["version"] == before["version"] + 1
        assert api(setup, "GET", url)["data"]["project"]["summary"] == f"responsive saved {width}"
        page.get_by_role("button", name="내보내기 (SQL / MD)", exact=True).click()
        markdown = page.get_by_role("button", name="Markdown 명세서 (Mermaid)", exact=True)
        inside_viewport(markdown, width, height)
        markdown.click()
        download_button = page.get_by_role("button", name="ARCHITECTURE_SPEC.md 다운로드", exact=True)
        inside_viewport(download_button, width, height)
        with page.expect_download() as pending:
            download_button.click()
        assert f"responsive saved {width}" in Path(pending.value.path()).read_text(encoding="utf-8")
        inside_viewport(page.get_by_role("button", name="내보내기 닫기", exact=True), width, height)
        page.screenshot(path=str(ROOT / f".local/final-responsive-{width}.png"))
        page.get_by_role("button", name="내보내기 닫기", exact=True).click()
    finally:
        context.close()
