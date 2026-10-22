"""W06: real React/Flask UI against isolated MariaDB and real Redis.

Keep server-valid minimal records as regression fixtures.
"""
from copy import deepcopy
import json
import os
import re
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from playwright.sync_api import expect

from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session
from app import create_app
from app.extensions import db

OUT: Path
TITLE = 'W06 네 영역 통합 검증'
SUMMARY = '예: 사내 스터디 매칭 & 출석 관리 플랫폼'


class VerificationContext(dict):
    def __repr__(self):
        return '<isolated verification context; credentials omitted>'


@pytest.fixture(autouse=True)
def evidence_directory(tmp_path):
    global OUT
    # 기본 실행은 pytest 임시 경로만 쓴다. 장기 증빙을 남길 때만 호출자가 경로를 지정한다.
    OUT = Path(os.environ.get('W06_EVIDENCE_DIR', str(tmp_path)))
    OUT.mkdir(parents=True, exist_ok=True)


@pytest.fixture
def integrated(browser_session, auth_app):
    browser, origin = browser_session
    client = auth_app.test_client()
    login = client.post('/api/auth/login', headers={'Origin': origin},
                        json={'loginId': 'auth-a', 'password': PASSWORD})
    headers = {'Authorization': 'Bearer ' + login.json['data']['accessToken']}
    result = client.post('/api/projects', headers=headers, json={'title': TITLE})
    assert result.status_code == 201
    pid = result.json['data']['id']
    member = client.post(f'/api/projects/{pid}/members', headers=headers, json={'loginId': 'auth-b'})
    assert member.status_code == 200
    url = f'/api/projects/{pid}/document'

    def read():
        response = client.get(url, headers=headers)
        assert response.status_code == 200
        return response.json['data']

    def save(payload=None, project=None):
        current = read()
        response = client.put(url, headers=headers, json={
            'baseVersion': current['version'], 'mutationId': str(uuid4()),
            'project': project or {'title': TITLE}, 'payload': payload or current['payload']})
        assert response.status_code == 200, response.json
        return read()

    contexts = []
    def open_editor(login_id='auth-a'):
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        contexts.append(context)
        page = context.new_page()
        page.goto(origin)
        page.get_by_label('아이디', exact=True).fill(login_id)
        page.get_by_label('비밀번호', exact=True).fill(PASSWORD)
        page.get_by_role('button', name='로그인', exact=True).click()
        page.get_by_role('button', name=TITLE, exact=False).click()
        expect(page.get_by_placeholder(SUMMARY)).to_be_visible()
        saved(page)
        return context, page

    yield VerificationContext(browser=browser, origin=origin, client=client, headers=headers,
           pid=pid, url=url, read=read, save=save, open=open_editor, app=auth_app)
    for context in contexts:
        context.close()


def saved(page):
    expect(page.get_by_role('status').filter(has_text='저장됨')).to_be_visible(timeout=15000)


def step(page, n):
    page.get_by_role('navigation').get_by_role('button').nth(n - 1).click()


def active_step(page, n):
    expect(page.get_by_role('navigation').get_by_role('button').nth(n - 1)).to_have_class(
        re.compile(r'.*bg-indigo-600.*'))


def avatar(page, following=False):
    suffix = '눌러서 따라가기 끄기' if following else '눌러서 이 사람 화면 따라가기'
    return page.locator('button[title]').filter(has=page.locator('span')).filter(
        has_text='검').and_(page.locator(f'button[title^="검증 B ·"][title$="{suffix}"]'))


def follow(page):
    button = page.locator('button[title^="검증 B ·"][title$="눌러서 이 사람 화면 따라가기"]')
    expect(button).to_be_enabled(timeout=10000)
    button.click()
    expect(page.locator('button[title^="검증 B ·"][title$="눌러서 따라가기 끄기"]')).to_be_visible()


def rich_payload():
    root, child, feature, first, second, conn, table, detail, col, fk, amount, stamp = [str(uuid4()) for _ in range(12)]
    payload = {'schemaVersion': 2,
        'ideas': [{'id': root, 'title': '통합 부모', 'category': 'problems_goals'},
                  {'id': child, 'title': '통합 자식', 'category': 'problems_goals', 'parentIdeaId': root}],
        'features': [{'id': feature, 'name': '통합 기능', 'relatedStoryId': child, 'status': 'PLANNED',
                      'method': 'POST', 'endpoint': '/api/integration'}],
        'nodes': [{'id': first, 'name': '통합 API', 'category': 'Service', 'x': 90, 'y': 110},
                  {'id': second, 'name': '통합 DB', 'category': 'DataStore', 'x': 440, 'y': 210}],
        'connections': [{'id': conn, 'sourceId': first, 'targetId': second, 'protocol': 'SQL',
                         'label': '저장 경로', 'description': '설명 보존 검증'}],
        'tables': [{'id': table, 'name': 'integration_users', 'x': 100, 'y': 80,
                    'relatedFeatureIds': [feature], 'columns': [
                        {'id': col, 'name': 'id', 'dataType': 'UUID', 'isPrimaryKey': True},
                        {'id': amount, 'name': 'amount', 'dataType': 'DECIMAL', 'precision': 12, 'scale': 3},
                        {'id': stamp, 'name': 'created_at', 'dataType': 'DATETIME', 'precision': 6}]},
                   {'id': detail, 'name': 'integration_details', 'x': 450, 'y': 100, 'columns': [
                       {'id': fk, 'name': 'user_id', 'dataType': 'UUID',
                        'isForeignKey': True, 'references': 'integration_users.id', 'relatedFeatureId': feature}]}]}
    # Fully populated records isolate view/position/round-trip checks from the
    # separate contract test for valid server records with optional fields absent.
    for item in payload['features']:
        item.update(domain='통합', priority='P0', assignee='검증 A', requestFields='None',
                    responseFields='{}', summary='통합 기능', responseStatusCodes=['200 OK'])
    for item in payload['nodes']:
        item.update(techStack=['Python'], description='통합 노드', assignedTeam='Backend')
    for item in payload['tables']:
        item.setdefault('relatedFeatureIds', [])
        item.setdefault('comment', '통합 테이블')
        for column in item['columns']:
            column.setdefault('comment', '')
    return payload


@pytest.mark.parametrize(('area', 'n'), [('features', 2), ('nodes', 3), ('tables', 4)])
def test_server_valid_optional_fields_must_render_without_crashing(integrated, area, n):
    env = integrated
    payload = {'schemaVersion': 2, 'ideas': [], 'features': [], 'nodes': [], 'connections': [], 'tables': []}
    item = {'id': str(uuid4()), 'name': 'minimal_record'}
    if area == 'nodes':
        item.update(category='Service', x=100, y=100)
    if area == 'tables':
        item.update(columns=[])
    payload[area] = [item]
    document = env['save'](payload)
    _, page = env['open']()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    step(page, n)
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT / f'w06-fix-minimal-{area}.png'))
    (OUT / f'w06-fix-minimal-{area}.json').write_text(json.dumps({
        'serverAcceptedDocument': document, 'browserErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    assert errors == [], f'Server-valid optional fields omitted: {errors}'
    expect(page.get_by_role('navigation')).to_be_visible()


def test_four_area_ui_create_uuid_remote_reload_and_fresh_flask(integrated):
    """SAVE01/VIEW01: create all areas in UI; verify UUID/links, two accounts, reload/new app."""
    env = integrated
    _, page = env['open']()
    page.get_by_label('새 아이디어 제목', exact=True).fill('UI 생성 아이디어')
    page.get_by_role('button', name='아이디어 등록', exact=True).click()
    saved(page)
    step(page, 2)
    page.get_by_role('button', name='기능 추가', exact=True).click()
    page.get_by_placeholder('예: 실시간 QR 출석 체크').fill('UI 생성 기능')
    page.get_by_role('button', name='기능 등록', exact=True).click()
    saved(page)
    step(page, 3)
    for name in ['UI API', 'UI DB']:
        page.get_by_role('button', name='노드 추가', exact=True).click()
        page.get_by_placeholder('예: Notification Worker').fill(name)
        page.get_by_placeholder('예: Node.js, BullMQ, FCM').fill('Python, MariaDB')
        page.get_by_role('button', name='노드 생성', exact=True).click()
        saved(page)
    page.get_by_role('button', name='연결선', exact=True).click()
    page.get_by_placeholder('예: 실시간 QR 인증 이벤트').fill('UI 연결')
    page.get_by_placeholder('예: WSS 양방향 동기화 및 heartbeat 30초 주기').fill('UI 연결 설명')
    page.get_by_role('button', name='연결선 등록', exact=True).click()
    saved(page)
    step(page, 4)
    page.get_by_role('button', name='테이블 추가', exact=True).click()
    page.get_by_placeholder('예: study_reviews').fill('ui_entities')
    page.get_by_role('checkbox', name='UI 생성 기능', exact=False).check()
    page.get_by_role('button', name='테이블 생성', exact=True).click()
    saved(page)
    document = env['read']()
    payload = document['payload']
    assert [len(payload[a]) for a in ['ideas', 'features', 'nodes', 'connections', 'tables']] == [1, 1, 2, 1, 1]
    ids = [x['id'] for a in ['ideas', 'features', 'nodes', 'connections', 'tables'] for x in payload[a]]
    ids += [x['id'] for x in payload['tables'][0]['columns']]
    assert len(ids) == len(set(ids)) and all(UUID(x).version == 4 for x in ids)
    assert payload['connections'][0]['description'] == 'UI 연결 설명'
    assert payload['tables'][0]['relatedFeatureIds'] == [payload['features'][0]['id']]
    _, other = env['open']('auth-b')
    step(other, 2)
    expect(other.get_by_text('UI 생성 기능', exact=True).first).to_be_visible()
    for n, text in [(1, 'UI 생성 아이디어'), (3, 'UI API'), (4, 'ui_entities')]:
        step(other, n)
        expect(other.get_by_text(text, exact=True).first).to_be_visible()
    page.reload()
    page.get_by_role('button', name=TITLE, exact=False).click()
    saved(page)
    assert env['read']()['payload'] == payload
    # A new Flask application/SQL engine reads exactly the same persisted document.
    fresh = create_app(dict(env['app'].config))
    fresh.extensions['token_repository'] = env['app'].extensions['token_repository']
    try:
        response = fresh.test_client().get(env['url'], headers=env['headers'])
        assert response.status_code == 200
        assert response.json['data'] == document
    finally:
        with fresh.app_context():
            db.session.remove()
            db.engine.dispose()
    step(page, 4)
    page.screenshot(path=str(OUT / 'w06-fix-four-areas.png'))


def test_rich_references_precision_round_trip_through_ui_save(integrated):
    env = integrated
    before = env['save'](rich_payload())
    _, page = env['open']()
    for n in [2, 3, 4, 1]:
        step(page, n)
    page.get_by_placeholder(SUMMARY).fill('네 영역 계약 왕복 저장')
    saved(page)
    after = env['read']()
    assert after['version'] == before['version'] + 1
    assert after['payload'] == before['payload']
    page.reload()
    page.get_by_role('button', name=TITLE, exact=False).click()
    expect(page.get_by_placeholder(SUMMARY)).to_have_value('네 영역 계약 왕복 저장')
    assert env['read']()['payload'] == before['payload']


def test_personal_steps_zoom_and_expansion_do_not_write_or_move_other_user(integrated):
    env = integrated
    env['save'](rich_payload())
    _, page = env['open']()
    _, other = env['open']('auth-b')
    baseline = env['read']()
    puts = []
    page.on('request', lambda r: puts.append(r.url) if r.method == 'PUT' and r.url.endswith('/document') else None)
    page.get_by_role('button', name='통합 부모 하위 펼치기', exact=True).click()
    for n in [2, 3, 4]:
        step(page, n)
        if n in [3, 4]:
            page.get_by_title('확대', exact=True).click()
            page.get_by_title('축소', exact=True).click()
    page.wait_for_timeout(2500)
    active_step(other, 1)
    assert env['read']() == baseline
    assert puts == []
    page.screenshot(path=str(OUT / 'w06-fix-personal-view.png'))


def test_follow_tracks_remote_step_then_manual_step_detaches(integrated):
    env = integrated
    _, page = env['open']()
    _, other = env['open']('auth-b')
    baseline = env['read']()
    step(other, 3)
    follow(page)
    active_step(page, 3)
    step(other, 4)
    active_step(page, 4)
    step(page, 2)
    step(other, 1)
    page.wait_for_timeout(2800)
    active_step(page, 2)
    assert env['read']() == baseline


def test_follow_explicit_toggle_detaches(integrated):
    _, page = integrated['open']()
    _, other = integrated['open']('auth-b')
    step(other, 3)
    follow(page)
    active_step(page, 3)
    page.locator('button[title^="검증 B ·"][title$="눌러서 따라가기 끄기"]').click()
    step(other, 4)
    page.wait_for_timeout(2800)
    active_step(page, 3)


def test_follow_target_departure_must_not_silently_resume_on_return(integrated):
    env = integrated
    _, page = env['open']()
    _, other = env['open']('auth-b')
    step(other, 3)
    follow(page)
    active_step(page, 3)
    other.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    expect(page.locator('button[title^="검증 B ·"][title*="오프라인"]')).to_be_visible(timeout=10000)
    active_step(page, 3)
    other.get_by_role('button', name=TITLE, exact=False).click()
    step(other, 4)
    page.wait_for_timeout(4500)
    page.screenshot(path=str(OUT / 'w06-fix-follow-return.png'))
    active_step(page, 3)
    follow(page)
    active_step(page, 4)


def test_follow_project_switch_clears_selection(integrated):
    env = integrated
    second = env['client'].post('/api/projects', headers=env['headers'], json={'title': 'W06 별도 프로젝트'})
    assert second.status_code == 201
    _, page = env['open']()
    _, other = env['open']('auth-b')
    step(other, 3)
    follow(page)
    active_step(page, 3)
    page.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    page.get_by_role('button', name='W06 별도 프로젝트', exact=False).click()
    step(page, 2)
    step(other, 4)
    page.wait_for_timeout(2500)
    active_step(page, 2)
    page.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    page.get_by_role('button', name=TITLE, exact=False).click()
    step(page, 2)
    step(other, 1)
    page.wait_for_timeout(2800)
    active_step(page, 2)


def test_hidden_document_poll_pauses_and_visible_focus_recovers(integrated):
    env = integrated
    _, page = env['open']()
    gets = []
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(400)
    page.on('request', lambda r: gets.append(r.url) if r.method == 'GET' and '/document' in r.url else None)
    env['save'](project={'title': TITLE, 'summary': '숨김 중 서버 변경'})
    page.wait_for_timeout(2400)
    assert gets == []
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))")
    expect(page.get_by_placeholder(SUMMARY)).to_have_value('숨김 중 서버 변경', timeout=10000)


@pytest.mark.parametrize(('area', 'n', 'name'), [('nodes', 3, '통합 API'), ('tables', 4, 'integration_users')])
def test_canvas_position_drag_persists_without_changing_ids_or_references(integrated, area, n, name):
    env = integrated
    before = env['save'](rich_payload())
    _, page = env['open']()
    step(page, n)
    page.get_by_title('배율 초기화', exact=True).click()
    card = page.locator('div[style*="left:"][style*="top:"]').filter(has=page.get_by_text(name, exact=True))
    box = card.bounding_box()
    assert box
    page.mouse.move(box['x'] + 24, box['y'] + 18)
    page.mouse.down()
    page.mouse.move(box['x'] + 104, box['y'] + 78, steps=8)
    page.mouse.up()
    saved(page)
    after = env['read']()
    moved = after['payload'][area][0]
    original = before['payload'][area][0]
    assert moved['id'] == original['id']
    assert abs(moved['x'] - original['x'] - 80) <= 2
    assert abs(moved['y'] - original['y'] - 60) <= 2
    expected_payload = deepcopy(before['payload'])
    expected_payload[area][0].update(x=moved['x'], y=moved['y'])
    assert after['payload'] == expected_payload
    page.reload()
    page.get_by_role('button', name=TITLE, exact=False).click()
    step(page, n)
    expect(page.locator('div[style*="left:"][style*="top:"]').filter(has=page.get_by_text(name, exact=True))).to_have_css('left', f'{moved["x"]}px')
    page.screenshot(path=str(OUT / f'w06-fix-drag-{area}.png'))


def test_two_tabs_one_account_leaving_one_must_keep_other_online(integrated):
    env = integrated
    _, owner = env['open']()
    context, first = env['open']('auth-b')
    second = context.new_page()
    second.goto(env['origin'])
    second.get_by_role('button', name=TITLE, exact=False).click()
    saved(second)
    expect(owner.locator('button[title^="검증 B ·"][title$="눌러서 이 사람 화면 따라가기"]')).to_be_visible(timeout=10000)
    step(second, 3)
    step(first, 3)
    follow(owner)
    active_step(owner, 3)
    # Hold the remaining tab's next heartbeat to expose whether DELETE removes
    # the whole user rather than the leaving tab. No server response is forged.
    held = []
    second.route(f'**/api/projects/{env["pid"]}/presence', lambda r: held.append(r) if r.request.method == 'POST' else r.continue_())
    second.wait_for_timeout(2200)
    first.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    owner.wait_for_timeout(2500)
    owner.screenshot(path=str(OUT / 'w06-fix-presence-tabs.png'))
    try:
        expect(owner.locator('button[title^="검증 B ·"][title$="눌러서 따라가기 끄기"]')).to_be_visible(timeout=1500)
    finally:
        for route in held:
            route.continue_()
        second.unroute(f'**/api/projects/{env["pid"]}/presence')


@pytest.mark.parametrize(('area', 'n'), [('features', 2), ('nodes', 3)])
def test_minimal_detail_editor_read_only_then_edit_preserves_references(integrated, area, n):
    env = integrated
    payload = rich_payload()
    item = payload[area][0]
    required = ('id', 'name') if area == 'features' else ('id', 'name', 'category', 'x', 'y')
    payload[area][0] = {key: item[key] for key in required}
    # Keep the other areas rich so references and unrelated fields are checked too.
    before = env['save'](payload)
    _, page = env['open']()
    puts = []
    page.on('request', lambda r: puts.append(r) if r.method == 'PUT' and '/document' in r.url else None)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    step(page, n)
    if area == 'features':
        page.get_by_text(item['name'], exact=True).first.click()
        expect(page.get_by_text('Request Payload (Schema)', exact=True)).to_be_visible()
        assert page.get_by_text('미지정', exact=True).count() >= 3  # list method/priority and detail method
        page.get_by_role('button', name='API 명세서 자동화', exact=True).click()
        expect(page.get_by_text('메서드/경로 미지정 1개 제외', exact=False)).to_be_visible()
        expect(page.locator('pre').last).not_to_contain_text('undefined')
        page.get_by_role('button', name='Swagger YAML', exact=True).click()
        expect(page.locator('pre').last).not_to_contain_text('undefined')
        page.get_by_role('button', name='Markdown 명세서', exact=True).click()
        expect(page.locator('pre').last).to_contain_text('미지정')
        page.screenshot(path=str(OUT / 'w06-fix-minimal-feature-detail.png'))
        # Reopen the project to close the export preview without depending on an icon-only locator.
        page.reload()
        page.get_by_role('button', name=TITLE, exact=False).click()
        step(page, 2)
    else:
        from test_architecture_browser import edit_node
        form = edit_node(page, item['name'])
        expect(form.locator('select').nth(1)).to_have_value('')
        expect(form.locator('input').nth(1)).to_have_value('')
        expect(form.locator('textarea')).to_have_value('')
        page.screenshot(path=str(OUT / 'w06-fix-minimal-node-editor.png'))
        form.get_by_role('button', name='속성 저장 (ID 보존)').click()
    page.wait_for_timeout(2600)
    assert not errors
    assert puts == []
    assert env['read']() == before
    with page.expect_response(lambda r: '/document' in r.url and r.request.method == 'PUT' and r.status == 200):
        if area == 'features':
            row = page.get_by_text(item['name'], exact=True).first.locator('..')
            row.locator('select').select_option('QA')
        else:
            form = edit_node(page, item['name'])
            form.locator('input').nth(0).fill('이름만 수정')
            form.get_by_role('button', name='속성 저장 (ID 보존)').click()
    saved(page)
    after = env['read']()
    changed = after['payload'][area][0]
    assert changed['id'] == item['id']
    if area == 'features':
        assert changed['status'] == 'QA'
        assert 'method' not in changed and 'priority' not in changed
        assert changed['name'] == item['name']
    else:
        assert changed['name'] == '이름만 수정'
        assert 'assignedTeam' not in changed
        assert (changed['x'], changed['y']) == (item['x'], item['y'])
    for key in ('ideas', 'connections', 'tables'):
        assert after['payload'][key] == before['payload'][key]
    other_area = 'nodes' if area == 'features' else 'features'
    assert after['payload'][other_area] == before['payload'][other_area]


def test_follow_temporary_presence_failure_keeps_selection_without_document_put(integrated):
    env = integrated
    before = env['read']()
    _, page = env['open']()
    _, other = env['open']('auth-b')
    step(other, 3)
    follow(page)
    active_step(page, 3)
    puts = []
    page.on('request', lambda r: puts.append(r) if r.method == 'PUT' and '/document' in r.url else None)
    pattern = f'**/api/projects/{env["pid"]}/presence'
    failed = []
    def temporary_failure(route):
        if route.request.method == 'POST':
            failed.append(True)
            route.abort('failed')
        else:
            route.continue_()
    page.route(pattern, temporary_failure)
    step(other, 4)
    page.wait_for_timeout(2800)
    assert failed
    expect(page.locator('button[title^="검증 B ·"][title$="눌러서 따라가기 끄기"]')).to_be_visible()
    active_step(page, 3)
    page.unroute(pattern)
    active_step(page, 4)
    assert puts == []
    assert env['read']() == before


def test_initial_and_stale_previous_project_presence_cannot_confirm_departure(integrated):
    env = integrated
    second = env['client'].post('/api/projects', headers=env['headers'], json={'title': 'W06 지연 경계'})
    assert second.status_code == 201
    _, other = env['open']('auth-b')
    step(other, 3)
    _, page = env['open']()
    follow(page)
    active_step(page, 3)
    held = []
    pattern = f'**/api/projects/{env["pid"]}/presence'
    def delayed_response(route):
        if route.request.method == 'POST':
            held.append((route, route.fetch()))  # real API response; only delivery is delayed
        else:
            route.continue_()
    page.route(pattern, delayed_response)
    page.wait_for_timeout(2200)
    assert held
    page.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    page.get_by_role('button', name='W06 지연 경계', exact=False).click()
    step(page, 2)
    for route, response in held:
        route.fulfill(response=response)
    page.unroute(pattern)
    step(other, 4)
    page.wait_for_timeout(2500)
    active_step(page, 2)
    page.get_by_title('프로젝트 목록(생성·참가)으로', exact=True).click()
    # Hold the current project's initial response: this is not an empty confirmed list.
    initial = []
    page.route(pattern, lambda r: initial.append(r) if r.request.method == 'POST' else r.continue_())
    page.get_by_role('button', name=TITLE, exact=False).click()
    step(page, 2)
    page.wait_for_timeout(2200)
    assert initial
    active_step(page, 2)
    for route in initial:
        route.continue_()
    page.unroute(pattern)
    follow(page)
    active_step(page, 4)
