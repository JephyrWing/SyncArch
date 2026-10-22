"""실제 Chrome 두 계정의 문서 API 검증입니다. W06 편집 UI 검증과 구분합니다."""
from copy import deepcopy
from uuid import uuid4

import pytest

from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in


def api(page, method, path, body=None):
    return page.evaluate("""async ({method,path,body}) => {
        const response = await fetch(path, {method, headers: {
            ...window.auth.authorization(), ...(body ? {'Content-Type':'application/json'} : {})
        }, ...(body ? {body:JSON.stringify(body)} : {})});
        return {status:response.status, body:response.status===204?null:await response.json()};
    }""", {"method": method, "path": path, "body": body})


def save_request(document):
    return {"baseVersion": document["version"], "mutationId": str(uuid4()),
        "project": {key: document["project"][key] for key in ("title", "summary", "categoryTag", "targetDbms")},
        "payload": deepcopy(document["payload"])}


@pytest.mark.deployment_smoke
def test_browser_two_accounts_save_conflict_replay_reload_activity_and_removal(browser_session):
    browser, origin = browser_session
    first, second = browser.new_context(), browser.new_context()
    try:
        owner, editor = open_page(first, origin), open_page(second, origin)
        assert sign_in(owner) == "검증 A"
        assert sign_in(editor, "auth-b") == "검증 B"
        pid = api(owner, "POST", "/api/projects", {"title": "저장 브라우저"})["body"]["data"]["id"]
        member = api(owner, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})["body"]["data"]
        url = f"/api/projects/{pid}/document"
        base = api(owner, "GET", url)["body"]["data"]
        request = save_request(base)
        request["project"]["title"] = "소유자 변경"
        competing = save_request(base)
        competing["project"]["title"] = "편집자의 보존할 변경"
        editor.evaluate("body => {window.pendingDraft = structuredClone(body);}", competing)
        saved = api(owner, "PUT", url, request)
        assert saved["status"] == 200
        conflict = api(editor, "PUT", url, competing)
        assert conflict["status"] == 409 and conflict["body"]["error"]["currentVersion"] == 3
        assert editor.evaluate("() => window.pendingDraft.project.title") == competing["project"]["title"]
        latest = api(editor, "GET", url)["body"]["data"]
        merged = save_request(latest)
        merged["project"]["title"] = competing["project"]["title"]
        assert api(editor, "PUT", url, merged)["status"] == 200
        replay = api(owner, "PUT", url, request)
        assert replay["status"] == 200 and replay["body"]["data"] == {**saved["body"]["data"], "replayed": True}
        editor.reload()
        editor.wait_for_function("Boolean(window.auth)")
        editor.evaluate("() => window.auth.me()")
        assert api(editor, "GET", url)["body"]["data"]["project"]["title"] == competing["project"]["title"]
        dashboard = api(editor, "GET", f"/api/projects/{pid}/dashboard")["body"]["data"]
        assert dashboard["version"] == 4 and dashboard["recentActivity"][0]["version"] == 4
        assert len(api(editor, "GET", f"/api/projects/{pid}/activity")["body"]["data"]["items"]) == 4
        assert api(owner, "DELETE", f'/api/projects/{pid}/members/{member["id"]}')["status"] == 204
        assert api(editor, "PUT", url, merged)["status"] == 404
        assert api(editor, "GET", f"/api/projects/{pid}/activity")["status"] == 404
    finally:
        first.close()
        second.close()
