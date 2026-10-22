"""W09 실제 편집 UI의 확인·취소·FK 일괄 저장과 충돌 복구를 검증합니다."""
from uuid import uuid4
import os
from pathlib import Path
import re

import pytest
from playwright.sync_api import expect

from conftest import app as base_app
from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in
from test_projects_browser import api


@pytest.fixture
def app(tmp_path, monkeypatch):
    # 실제 MariaDB 설정은 유지하고, 로컬 SQLite만 별도 파일로 분리해 HTTP 스레드의 연결 공유를 막는다.
    if not os.getenv("TEST_DATABASE_URL"):
        monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///" + (tmp_path / "w09.db").as_posix())
    yield from base_app.__wrapped__()


def erd_workspace(context, origin):
    setup = open_page(context, origin)
    sign_in(setup)
    project = api(setup, "POST", "/api/projects", {"title": "W09 ERD 검증"})["data"]
    url = f'/api/projects/{project["id"]}/document'
    document = api(setup, "GET", url)["data"]
    document["payload"]["features"] = [{"id": str(uuid4()), "name": "W09 기능", "displayCode": "FEAT-01",
        "domain": "설계", "priority": "P1", "method": "GET", "endpoint": "/erd", "status": "PLANNED"}]
    root_id, child_id = str(uuid4()), str(uuid4())
    document["payload"]["ideas"] = [
        {"id": root_id, "title": "W09 원본", "category": "problems_goals"},
        {"id": child_id, "title": "W09 하위", "parentIdeaId": root_id, "category": "problems_goals"},
        {"id": str(uuid4()), "title": "W09 유지", "category": "problems_goals"},
    ]
    feature_id = document["payload"]["features"][0]["id"]
    document["payload"]["features"][0]["relatedStoryId"] = child_id
    nodes = [{"id": str(uuid4()), "name": name, "category": "Service", "techStack": [], "description": "",
              "x": 100 + index * 300, "y": 100} for index, name in enumerate(["W09 시작", "W09 중간", "W09 끝"])]
    document["payload"]["nodes"] = nodes
    document["payload"]["connections"] = [
        {"id": str(uuid4()), "sourceId": nodes[0]["id"], "targetId": nodes[1]["id"], "protocol": "REST", "label": "삭제 대상"},
        {"id": str(uuid4()), "sourceId": nodes[1]["id"], "targetId": nodes[2]["id"], "protocol": "REST", "label": "유지 대상"},
    ]
    def column(name, **extra):
        return {"id": str(uuid4()), "name": name, "dataType": "INT", "isPrimaryKey": False,
                "isForeignKey": False, "isUnique": False, "isNullable": True, "comment": "", **extra}
    def table(name, columns):
        return {"id": str(uuid4()), "name": name, "columns": columns, "comment": "",
                "relatedFeatureIds": [], "x": 100 if name == "parents" else 500, "y": 100}
    document["payload"]["tables"] = [
        table("parents", [column("id", isPrimaryKey=True, isNullable=False), column("label")]),
        table("children", [column("id", isPrimaryKey=True, isNullable=False),
                           column("parent_id", isForeignKey=True, references="parents.id", relatedFeatureId=feature_id),
                           column("backup_id", isForeignKey=True, references="parents.id")]),
    ]
    result = api(setup, "PUT", url, {"baseVersion": document["version"], "mutationId": str(uuid4()),
        "project": {key: project[key] for key in ("title", "summary", "categoryTag", "targetDbms")},
        "payload": document["payload"]})
    assert result["status"] == 200
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(origin)
    page.get_by_role("button").filter(has_text="W09 ERD 검증").click()
    page.get_by_role("button", name="DB(ERD)", exact=False).first.click()
    page.wait_for_timeout(300)
    assert not errors, errors
    expect(page.get_by_label("id 컬럼명", exact=True)).to_be_visible()
    return page, setup, url


def saved(page, action):
    with page.expect_response(lambda response: response.request.method == "PUT" and
                             response.url.endswith("/document")) as pending:
        action()
    response = pending.value
    assert response.status == 200, response.text()
    return response.json()["data"]


def test_erd_rename_cancel_duplicate_atomic_save_and_reload(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        before = api(setup, "GET", url)["data"]
        page.get_by_role("button", name="이름 변경", exact=True).click()
        page.get_by_label("새 테이블 이름").fill("children")
        expect(page.get_by_role("button", name="변경", exact=True)).to_be_disabled()
        page.get_by_role("button", name="취소", exact=True).click()
        name = page.get_by_label("id 컬럼명", exact=True)
        name.fill("parent_key")
        expect(page.get_by_text("children.parent_id: parents.id → parents.parent_key", exact=True)).to_be_visible()
        page.get_by_role("button", name="취소", exact=True).click()
        expect(name).to_have_value("id")
        name.fill("label")
        expect(page.get_by_role("button", name="컬럼명 적용", exact=True)).to_be_disabled()
        page.wait_for_timeout(700)
        assert api(setup, "GET", url)["data"]["version"] == before["version"]
        name.fill("parent_key")
        stored = saved(page, lambda: page.get_by_role("button", name="컬럼명 적용", exact=True).click())
        assert stored["payload"]["tables"][0]["columns"][0]["name"] == "parent_key"
        child = stored["payload"]["tables"][1]["columns"][1]
        assert child["references"] == "parents.parent_key" and child["name"] == "parent_id"
        assert stored["payload"]["tables"][1]["columns"][2]["references"] == "parents.parent_key"
        stored = saved(page, lambda: page.get_by_label("label UNIQUE", exact=True).check())
        assert stored["payload"]["tables"][0]["columns"][1]["isUnique"]
        stored = saved(page, lambda: page.get_by_label("label 기본값", exact=True).fill("42"))
        assert stored["payload"]["tables"][0]["columns"][1]["defaultValue"] == "42"
        page.reload()
        page.get_by_role("button").filter(has_text="W09 ERD 검증").click()
        page.get_by_role("button", name="DB(ERD)", exact=False).first.click()
        expect(page.get_by_label("parent_key 컬럼명", exact=True)).to_be_visible()
        expect(page.get_by_label("label UNIQUE", exact=True)).to_be_checked()
        expect(page.get_by_label("label 기본값", exact=True)).to_have_value("42")
        page.screenshot(path=str(Path(__file__).resolve().parents[2] / ".local/w09-erd.png"))
    finally:
        context.close()


def test_erd_table_rename_conflict_rebase_and_delete_cancel(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        page.get_by_role("button", name="이름 변경", exact=True).click()
        page.get_by_label("새 테이블 이름").fill("members")
        writes = []
        def conflict_once(route):
            if route.request.method != "PUT":
                route.continue_()
                return
            writes.append(route.request.post_data_json)
            if len(writes) == 1:
                route.fulfill(status=409, content_type="application/json",
                              body='{"error":{"code":"VERSION_CONFLICT","message":"검증 충돌"}}')
            else:
                route.continue_()
        page.route("**" + url, conflict_once)
        page.get_by_role("button", name="변경", exact=True).click()
        expect(page.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=10000)
        assert len(writes) == 2
        assert writes[0]["mutationId"] != writes[1]["mutationId"]
        for body in writes:
            assert body["payload"]["tables"][0]["name"] == "members"
            assert body["payload"]["tables"][1]["columns"][1]["references"] == "members.id"
        page.unroute("**" + url, conflict_once)
        before = api(setup, "GET", url)["data"]
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_title("테이블 삭제", exact=True).click()
        page.wait_for_timeout(700)
        assert api(setup, "GET", url)["data"] == before
        page.once("dialog", lambda dialog: dialog.accept())
        stored = saved(page, lambda: page.get_by_title("테이블 삭제", exact=True).click())
        assert len(stored["payload"]["tables"]) == 1
        child = stored["payload"]["tables"][0]["columns"][1]
        assert child["name"] == "parent_id" and not child["isForeignKey"]
        assert not child.get("references")
        assert not stored["payload"]["tables"][0]["columns"][2]["isForeignKey"]
    finally:
        context.close()


def test_erd_feature_link_save_and_delete_cleans_all_links(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        stored = saved(page, lambda: page.get_by_label("FEAT-01 기능 연결", exact=True).check())
        feature_id = stored["payload"]["features"][0]["id"]
        assert stored["payload"]["tables"][0]["relatedFeatureIds"] == [feature_id]
        page.reload()
        page.get_by_role("button").filter(has_text="W09 ERD 검증").click()
        page.get_by_role("button", name="DB(ERD)", exact=False).first.click()
        expect(page.get_by_label("FEAT-01 기능 연결", exact=True)).to_be_checked()
        page.get_by_role("button", name="기능·API 명세", exact=False).first.click()
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_title("기능 삭제", exact=True).click()
        assert len(api(setup, "GET", url)["data"]["payload"]["features"]) == 1
        page.once("dialog", lambda dialog: dialog.accept())
        stored = saved(page, lambda: page.get_by_title("기능 삭제", exact=True).click())
        assert stored["payload"]["features"] == []
        assert stored["payload"]["tables"][0]["relatedFeatureIds"] == []
        assert len(stored["payload"]["tables"][0]["columns"]) == 2
        assert not stored["payload"]["tables"][1]["columns"][1].get("relatedFeatureId")
    finally:
        context.close()


def test_erd_validation_failure_preserves_entire_rename_draft_and_server_document(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        before = api(setup, "GET", url)["data"]
        attempted = []
        def reject(route):
            if route.request.method == "PUT":
                attempted.append(route.request.post_data_json)
                route.fulfill(status=422, content_type="application/json",
                              body='{"error":{"code":"DOCUMENT_INVALID","message":"검증 실패"}}')
            else:
                route.continue_()
        page.route("**" + url, reject)
        page.get_by_role("button", name="이름 변경", exact=True).click()
        page.get_by_label("새 테이블 이름").fill("members")
        page.get_by_role("button", name="변경", exact=True).click()
        expect(page.get_by_role("status").filter(has_text="저장 안 됨")).to_be_visible()
        assert len(attempted) == 1
        assert [c["references"] for c in attempted[0]["payload"]["tables"][1]["columns"] if c.get("isForeignKey")] == ["members.id", "members.id"]
        assert api(setup, "GET", url)["data"] == before
        page.unroute("**" + url, reject)
        stored = saved(page, lambda: page.get_by_label("label 기본값", exact=True).fill("7"))
        assert stored["payload"]["tables"][0]["name"] == "members"
        assert [c["references"] for c in stored["payload"]["tables"][1]["columns"] if c.get("isForeignKey")] == ["members.id", "members.id"]
    finally:
        context.close()


def test_erd_invalid_foreign_keys_do_not_save_and_column_delete_clears_every_reference(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        before = api(setup, "GET", url)["data"]
        page.get_by_role("button", name=re.compile(r"^children")).click()
        reference = page.get_by_label("parent_id 참조 컬럼", exact=True)
        for value, error in [("missing.id", "없습니다"), ("parents.label", "PK 또는 UNIQUE")]:
            reference.fill(value)
            reference.press("Enter")
            expect(page.get_by_role("alert").filter(has_text=error)).to_be_visible()
            reference.press("Escape")
        kind = page.get_by_role("combobox", name="parent_id 데이터 타입", exact=True)
        kind.fill("VARCHAR(40)")
        kind.press("Enter")
        expect(page.get_by_role("alert").filter(has_text="불일치")).to_be_visible()
        kind.press("Escape")
        page.wait_for_timeout(700)
        assert api(setup, "GET", url)["data"] == before
        page.get_by_role("button", name=re.compile(r"^parents")).click()
        page.get_by_label("id PK", exact=True).click()
        expect(page.get_by_label("id PK", exact=True)).to_be_checked()
        expect(page.get_by_role("alert").filter(has_text="PK 또는 UNIQUE")).to_be_visible()
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_title("컬럼 삭제", exact=True).first.click()
        assert api(setup, "GET", url)["data"] == before
        page.once("dialog", lambda dialog: dialog.accept())
        stored = saved(page, lambda: page.get_by_title("컬럼 삭제", exact=True).first.click())
        assert [c["name"] for c in stored["payload"]["tables"][0]["columns"]] == ["label"]
        for column in stored["payload"]["tables"][1]["columns"][1:]:
            assert not column["isForeignKey"] and not column.get("references")
    finally:
        context.close()


def test_safe_idea_branch_and_node_deletion_preserve_unrelated_data(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        before = api(setup, "GET", url)["data"]
        page.get_by_role("button", name="아이디어 보드", exact=False).first.click()
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_title("삭제", exact=True).first.click()
        assert api(setup, "GET", url)["data"] == before
        page.once("dialog", lambda dialog: dialog.accept())
        stored = saved(page, lambda: page.get_by_title("삭제", exact=True).first.click())
        assert [idea["title"] for idea in stored["payload"]["ideas"]] == ["W09 유지"]
        assert not stored["payload"]["features"][0].get("relatedStoryId")
        assert stored["payload"]["tables"] == before["payload"]["tables"]
        page.get_by_role("button", name="시스템 아키텍처", exact=False).first.click()
        page.once("dialog", lambda dialog: dialog.dismiss())
        page.get_by_title("노드 삭제", exact=True).first.click()
        assert len(api(setup, "GET", url)["data"]["payload"]["nodes"]) == 3
        page.once("dialog", lambda dialog: dialog.accept())
        stored = saved(page, lambda: page.get_by_title("노드 삭제", exact=True).first.click())
        assert len(stored["payload"]["nodes"]) == 2
        assert [connection["label"] for connection in stored["payload"]["connections"]] == ["유지 대상"]
    finally:
        context.close()


def test_two_accounts_real_409_merges_erd_rename_with_teammate_column_edit(browser_session):
    browser, origin = browser_session
    owner_context = browser.new_context(viewport={"width": 1800, "height": 1100})
    editor_context = browser.new_context(viewport={"width": 1800, "height": 1100})
    held = []
    try:
        owner, setup, url = erd_workspace(owner_context, origin)
        pid = url.split("/")[3]
        assert api(setup, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})["status"] == 200
        editor = open_page(editor_context, origin)
        sign_in(editor, "auth-b")
        editor.goto(origin)
        editor.get_by_role("button").filter(has_text="W09 ERD 검증").click()
        editor.get_by_role("button", name="DB(ERD)", exact=False).first.click()
        writes = []
        def delay_first(route):
            if route.request.method == "PUT":
                writes.append(route.request.post_data_json)
                if len(writes) == 1:
                    held.append(route)
                    return
            route.continue_()
        owner.route("**" + url, delay_first)
        owner.get_by_role("button", name="이름 변경", exact=True).click()
        owner.get_by_label("새 테이블 이름").fill("members")
        owner.get_by_role("button", name="변경", exact=True).click()
        expect(owner.get_by_role("status").filter(has_text="저장 중")).to_be_visible()
        assert len(held) == 1
        saved(editor, lambda: editor.get_by_label("label 설명", exact=True).fill("팀원 유지"))
        route = held.pop()
        response = route.fetch()
        assert response.status == 409
        route.fulfill(response=response)
        expect(owner.get_by_role("status").filter(has_text="저장됨")).to_be_visible(timeout=10000)
        assert len(writes) == 2 and writes[0]["mutationId"] != writes[1]["mutationId"]
        document = api(setup, "GET", url)["data"]
        assert document["payload"]["tables"][0]["name"] == "members"
        assert document["payload"]["tables"][0]["columns"][1]["comment"] == "팀원 유지"
        assert [c["references"] for c in document["payload"]["tables"][1]["columns"][1:]] == ["members.id", "members.id"]
    finally:
        for route in held:
            route.abort()
        owner_context.close()
        editor_context.close()


def test_erd_all_column_properties_parameters_and_new_names_survive_reload(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={"width": 1800, "height": 1100})
    try:
        page, setup, url = erd_workspace(context, origin)
        saved(page, lambda: page.get_by_label("테이블 설명", exact=True).fill("검증 테이블"))
        kind = page.get_by_role("combobox", name="label 데이터 타입", exact=True)
        def apply_type(value):
            kind.fill(value)
            kind.press("Enter")
        stored = saved(page, lambda: apply_type("VARCHAR(80)"))
        assert stored["payload"]["tables"][0]["columns"][1]["length"] == 80
        def length():
            page.get_by_role("spinbutton", name="label 길이", exact=True).fill("120")
            page.get_by_role("spinbutton", name="label 길이", exact=True).press("Enter")
        stored = saved(page, length)
        assert stored["payload"]["tables"][0]["columns"][1]["length"] == 120
        saved(page, lambda: apply_type("DECIMAL(12,2)"))
        def precision():
            page.get_by_role("spinbutton", name="label 전체 자릿수", exact=True).fill("14")
            page.get_by_role("spinbutton", name="label 소수 자릿수", exact=True).fill("4")
            page.get_by_role("spinbutton", name="label 소수 자릿수", exact=True).press("Enter")
        stored = saved(page, precision)
        column = stored["payload"]["tables"][0]["columns"][1]
        assert (column["precision"], column["scale"]) == (14, 4)
        assert "length" not in column
        saved(page, lambda: page.get_by_label("label 설명", exact=True).fill("금액"))
        saved(page, lambda: page.get_by_label("label 기본값", exact=True).fill("0"))
        saved(page, lambda: page.get_by_label("label UNIQUE", exact=True).check())
        page.get_by_label("label PK", exact=True).click()
        expect(page.get_by_label("label PK", exact=True)).not_to_be_checked()
        expect(page.get_by_role("alert").filter(has_text="단일 컬럼 PK")).to_be_visible()
        saved(page, lambda: page.get_by_label("id UNIQUE", exact=True).check())
        saved(page, lambda: page.get_by_label("id PK", exact=True).uncheck())
        stored = saved(page, lambda: page.get_by_label("label PK", exact=True).check())
        assert not stored["payload"]["tables"][0]["columns"][1]["isNullable"]
        expect(page.get_by_label("label NULL 허용", exact=True)).to_be_disabled()
        saved(page, lambda: page.get_by_role("button", name="컬럼 추가", exact=True).click())
        stored = saved(page, lambda: page.get_by_role("button", name="컬럼 추가", exact=True).click())
        assert [c["name"] for c in stored["payload"]["tables"][0]["columns"]][-2:] == ["new_column", "new_column_2"]
        page.get_by_role("button", name="테이블 추가", exact=True).click()
        page.get_by_placeholder("예: study_reviews").fill("parents")
        expect(page.get_by_role("button", name="테이블 생성", exact=True)).to_be_disabled()
        expect(page.get_by_role("alert").filter(has_text="같은 이름의 테이블")).to_be_visible()
        page.get_by_placeholder("예: study_reviews").fill("audit")
        stored = saved(page, lambda: page.get_by_role("button", name="테이블 생성", exact=True).click())
        assert stored["payload"]["tables"][-1]["name"] == "audit"
        assert stored["payload"]["tables"][-1]["columns"][0]["isPrimaryKey"]
        page.reload()
        page.get_by_role("button").filter(has_text="W09 ERD 검증").click()
        page.get_by_role("button", name="DB(ERD)", exact=False).first.click()
        expect(page.get_by_label("label 설명", exact=True)).to_have_value("금액")
        expect(page.get_by_label("테이블 설명", exact=True)).to_have_value("검증 테이블")
        expect(page.get_by_label("label 기본값", exact=True)).to_have_value("0")
        expect(page.get_by_label("label PK", exact=True)).to_be_checked()
        expect(page.get_by_label("label UNIQUE", exact=True)).to_be_checked()
        expect(page.get_by_role("spinbutton", name="label 전체 자릿수", exact=True)).to_have_value("14")
        expect(page.get_by_role("spinbutton", name="label 소수 자릿수", exact=True)).to_have_value("4")
        assert api(setup, "GET", url)["data"]["payload"]["tables"][0]["columns"][1]["dataType"] == "DECIMAL"
    finally:
        context.close()
