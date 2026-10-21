"""W04 API를 실제 두 브라우저 계정에서 검증합니다. 편집 UI 검증과 구분합니다."""
from test_auth_browser import browser_session, open_page, sign_in
from test_auth import auth_app


def api(page, method, path, body=None):
    return page.evaluate("""async ({method,path,body}) => {
        const response = await fetch(path, {method, headers: {
            ...window.auth.authorization(), ...(body ? {'Content-Type':'application/json'} : {})
        }, ...(body ? {body:JSON.stringify(body)} : {})});
        return {status:response.status, data:response.status===204?null:(await response.json()).data};
    }""", {"method": method, "path": path, "body": body})


def test_browser_project_visibility_member_removal_and_owner_guards(browser_session):
    browser, origin = browser_session
    owner_context, editor_context = browser.new_context(), browser.new_context()
    try:
        owner, editor = open_page(owner_context, origin), open_page(editor_context, origin)
        assert sign_in(owner) == "검증 A"
        assert sign_in(editor, "auth-b") == "검증 B"
        project = api(owner, "POST", "/api/projects", {"title": "브라우저 프로젝트"})
        assert project["status"] == 201
        pid = project["data"]["id"]
        assert api(editor, "GET", "/api/projects")["data"] == []
        assert api(editor, "GET", f"/api/projects/{pid}/document")["status"] == 404
        member = api(owner, "POST", f"/api/projects/{pid}/members", {"loginId": "auth-b"})
        assert member["status"] == 200
        assert len(api(editor, "GET", "/api/projects")["data"]) == 1
        assert api(editor, "PATCH", f"/api/projects/{pid}/archive", {"archived": True})["status"] == 403
        assert api(owner, "DELETE", f'/api/projects/{pid}/members/{project["data"]["ownerId"]}')["status"] == 403
        assert api(owner, "DELETE", f'/api/projects/{pid}/members/{member["data"]["id"]}')["status"] == 204
        assert api(editor, "GET", f"/api/projects/{pid}/document")["status"] == 404
        assert api(editor, "GET", "/api/projects")["data"] == []
    finally:
        owner_context.close()
        editor_context.close()


def test_browser_explicit_template_copy_archive_restore(browser_session):
    browser, origin = browser_session
    context = browser.new_context()
    try:
        page = open_page(context, origin)
        assert sign_in(page) == "검증 A"
        templates = api(page, "GET", "/api/project-templates")["data"]
        assert api(page, "GET", "/api/projects")["data"] == []
        copied = api(page, "POST", f'/api/project-templates/{templates[0]["id"]}/clone',
                     {"sourceVersion": templates[0]["version"], "title": "브라우저 예시 복사"})
        assert copied["status"] == 201
        pid = copied["data"]["id"]
        page.reload()
        page.wait_for_function("Boolean(window.auth)")
        assert page.evaluate("() => window.auth.me().then(u=>u.displayName)") == "검증 A"
        document = api(page, "GET", f"/api/projects/{pid}/document")
        assert document["data"]["project"]["title"] == "브라우저 예시 복사"
        assert document["data"]["payload"] == templates[0]["payload"]
        archived = api(page, "PATCH", f"/api/projects/{pid}/archive", {"archived": True})
        assert archived["status"] == 200 and archived["data"]["archived"] is True
        assert api(page, "GET", "/api/projects")["data"] == []
        assert len(api(page, "GET", "/api/projects?archived=true")["data"]) == 1
        restored = api(page, "PATCH", f"/api/projects/{pid}/archive", {"archived": False})
        assert restored["status"] == 200 and restored["data"]["archived"] is False
    finally:
        context.close()
