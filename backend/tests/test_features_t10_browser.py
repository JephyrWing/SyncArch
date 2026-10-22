"""W11 T10 / TC-FEAT-01..03: real two-account product, MariaDB and saved references."""
from copy import deepcopy
from uuid import UUID,uuid4
from pathlib import Path
import json
from playwright.sync_api import expect
from test_auth import auth_app
from test_auth_browser import browser_session,open_page,sign_in
from test_workspace_browser import workspace
from test_projects_browser import api
from test_documents_browser import save_request
from test_w06_optional_browser import rich_payload

TITLE='W11 T10 features'
STEP='Step 2. 기능·API 명세'

def setup_case(context,origin):
    page,pid=workspace(context,origin,title=TITLE)
    setup=open_page(context,origin);sign_in(setup)
    path=f'/api/projects/{pid}/document';body=save_request(api(setup,'GET',path)['data'])
    body['payload']=rich_payload()
    assert api(setup,'PUT',path,body)['status']==200
    page.reload();page.get_by_role('button',name=TITLE,exact=False).click()
    page.get_by_role('button',name=STEP,exact=True).click()
    expect(page.get_by_text('통합 기능',exact=True).first).to_be_visible()
    return page,setup,pid,path

def saved(page):
    expect(page.get_by_role('status').filter(has_text='저장됨')).to_be_visible(timeout=15000)

def reopen(page,origin):
    page.goto(origin);page.get_by_role('button',name=TITLE,exact=False).click()
    page.get_by_role('button',name=STEP,exact=True).click()

def test_feat01_all_fields_edit_cancel_validate_save_reload_and_other_account(browser_session):
    browser,origin=browser_session;a,b=browser.new_context(),browser.new_context()
    try:
        page,setup,pid,path=setup_case(a,origin)
        assert api(setup,'POST',f'/api/projects/{pid}/members',{'loginId':'auth-b'})['status']==200
        remote,_=workspace(b,origin,title=TITLE,login_id='auth-b',project_id=pid)
        remote.get_by_role('button',name=STEP,exact=True).click()
        before=api(setup,'GET',path)['data'];original=before['payload']['features'][0]
        button=page.get_by_role('button',name='기능 편집',exact=True)
        expect(button).to_be_visible(timeout=5000);button.click()
        form=page.get_by_role('dialog',name='기능 편집',exact=True)
        form.get_by_label('기능명',exact=True).fill('취소할 변경')
        form.get_by_role('button',name='취소',exact=True).click()
        assert api(setup,'GET',path)['data']==before
        button.click();form.get_by_label('기능명',exact=True).fill('   ')
        form.get_by_role('button',name='변경 저장',exact=True).click()
        expect(form).to_be_visible();assert api(setup,'GET',path)['data']['version']==before['version']
        for label,value in {'기능명':'T10 edited API','도메인':'검증 도메인','엔드포인트 경로':'/api/t10/edited',
            'Request Fields':'id: UUID, count: integer','Response Fields':'result: string','기능 설명':'설명 보존',
            '응답 상태 코드':'201 Created\n409 Conflict'}.items():form.get_by_label(label,exact=True).fill(value)
        for label,value in {'담당자':'검증 B','우선순위':'P2','HTTP 메서드':'PATCH','진행상황':'COMPLETED'}.items():form.get_by_label(label,exact=True).select_option(value)
        form.get_by_role('button',name='변경 저장',exact=True).click();saved(page)
        after=api(setup,'GET',path)['data'];f=after['payload']['features'][0]
        assert f['id']==original['id'] and f['relatedStoryId']==original['relatedStoryId']
        assert {k:f[k] for k in ['name','domain','endpoint','requestFields','responseFields','summary','assignee','priority','method','status','responseStatusCodes']}=={
            'name':'T10 edited API','domain':'검증 도메인','endpoint':'/api/t10/edited','requestFields':'id: UUID, count: integer',
            'responseFields':'result: string','summary':'설명 보존','assignee':'검증 B','priority':'P2','method':'PATCH','status':'COMPLETED','responseStatusCodes':['201 Created','409 Conflict']}
        assert after['payload']['tables']==before['payload']['tables']
        remote.bring_to_front();expect(remote.get_by_text('T10 edited API',exact=True).first).to_be_visible(timeout=10000)
        for current in [page,remote]:
            reopen(current,origin);expect(current.get_by_text('T10 edited API',exact=True).first).to_be_visible()
        overview=api(setup,'GET',f'/api/projects/{pid}/dashboard')['data']
        assert overview['counts']['features']==1
        expect(page.get_by_text('100%',exact=True)).to_be_visible()
        page.get_by_role('button',name='기능 편집',exact=True).click()
        # A stale modal must not revert a teammate's status while editing a different field.
        remote.get_by_role('button',name='기능 편집',exact=True).click()
        other=remote.get_by_role('dialog',name='기능 편집',exact=True)
        other.get_by_label('진행상황',exact=True).select_option('QA')
        other.get_by_role('button',name='변경 저장',exact=True).click();saved(remote)
        page.wait_for_timeout(1300)
        form.get_by_label('기능 설명',exact=True).fill('local description after remote status')
        form.get_by_role('button',name='변경 저장',exact=True).click();saved(page)
        latest=api(setup,'GET',path)['data']['payload']['features'][0]
        assert latest['status']=='QA' and latest['summary']=='local description after remote status'
        page.screenshot(path=str(Path(__file__).resolve().parents[2]/'.local/w11-t10-edit.png'))
    finally:a.close();b.close()

def test_feat_delete_confirm_cleans_only_its_erd_references_atomically(browser_session):
    browser,origin=browser_session;context=browser.new_context()
    try:
        page,setup,pid,path=setup_case(context,origin);before=api(setup,'GET',path)['data']
        page.once('dialog',lambda dialog:dialog.dismiss())
        page.get_by_title('기능 삭제',exact=True).click()
        assert api(setup,'GET',path)['data']==before
        page.once('dialog',lambda dialog:dialog.accept())
        page.get_by_title('기능 삭제',exact=True).click();saved(page)
        after=api(setup,'GET',path)['data'];assert after['payload']['features']==[]
        assert after['version']==before['version']+1
        expected=deepcopy(before['payload']['tables'])
        for table in expected:
            table['relatedFeatureIds']=[]
            for col in table['columns']:col.pop('relatedFeatureId',None)
        assert after['payload']['tables']==expected
    finally:context.close()

def test_feat_import_same_idea_concurrently_never_creates_duplicate_origin(browser_session):
    browser,origin=browser_session;a,b=browser.new_context(),browser.new_context()
    try:
        page,setup,pid,path=setup_case(a,origin)
        assert api(setup,'POST',f'/api/projects/{pid}/members',{'loginId':'auth-b'})['status']==200
        remote,_=workspace(b,origin,title=TITLE,login_id='auth-b',project_id=pid)
        remote.get_by_role('button',name=STEP,exact=True).click()
        # Root is not imported yet; both users choose it from the same saved base.
        held=[]
        for current in [page,remote]:
            current.route('**'+path,lambda route:held.append(route) if route.request.method=='PUT' else route.continue_())
            current.get_by_role('button',name='아이디어 선택하여 가져오기',exact=True).click()
            current.get_by_role('dialog',name='아이디어 가져오기',exact=True).get_by_label('통합 부모',exact=True).check()
            current.get_by_role('button',name='선택 가져오기',exact=True).click()
        page.wait_for_timeout(700);assert len(held)==2
        for route in held:route.continue_()
        for current in [page,remote]:current.unroute('**'+path)
        for current in [page,remote]:saved(current)
        final=api(setup,'GET',path)['data']
        root=final['payload']['ideas'][0]['id']
        assert sum(f.get('relatedStoryId')==root for f in final['payload']['features'])==1
    finally:a.close();b.close()

def test_feat02_select_hidden_descendant_without_vote_threshold_and_no_duplicate(browser_session):
    browser,origin=browser_session;context=browser.new_context()
    try:
        page,setup,pid,path=setup_case(context,origin)
        body=save_request(api(setup,'GET',path)['data']);body['payload']['features']=[]
        for t in body['payload']['tables']:
            t['relatedFeatureIds']=[]
            for c in t['columns']:c.pop('relatedFeatureId',None)
        assert api(setup,'PUT',path,body)['status']==200
        reopen(page,origin);before=api(setup,'GET',path)['data']
        button=page.get_by_role('button',name='아이디어 선택하여 가져오기',exact=True)
        expect(button).to_be_enabled(timeout=5000);button.click()
        dialog=page.get_by_role('dialog',name='아이디어 가져오기',exact=True)
        dialog.get_by_label('통합 자식',exact=True).check()
        dialog.get_by_role('button',name='선택 가져오기',exact=True).click();saved(page)
        after=api(setup,'GET',path)['data'];features=after['payload']['features']
        assert len(features)==1 and features[0]['name']=='통합 자식'
        assert features[0]['relatedStoryId']==before['payload']['ideas'][1]['id'];UUID(features[0]['id'])
        assert after['payload']['ideas']==before['payload']['ideas']
        button.click();expect(dialog.get_by_label('통합 자식',exact=True)).to_be_disabled()
        dialog.get_by_role('button',name='취소',exact=True).click()
        assert api(setup,'GET',path)['data']==after
        reopen(page,origin);expect(page.get_by_text('통합 자식',exact=True).first).to_be_visible()
    finally:context.close()

def test_feat03_middle_delete_create_two_accounts_and_reference_preservation(browser_session):
    browser,origin=browser_session;a,b=browser.new_context(),browser.new_context()
    try:
        page,setup,pid,path=setup_case(a,origin)
        body=save_request(api(setup,'GET',path)['data']);first=body['payload']['features'][0]
        first['displayCode']='FEAT-01'
        for number in [2,3]:body['payload']['features'].append(dict(first,id=str(uuid4()),name=f'T10 feature {number}',displayCode=f'FEAT-0{number}'))
        assert api(setup,'PUT',path,body)['status']==200
        assert api(setup,'POST',f'/api/projects/{pid}/members',{'loginId':'auth-b'})['status']==200
        reopen(page,origin);before=api(setup,'GET',path)['data']
        page.get_by_title('기능 삭제',exact=True).nth(1).click();saved(page)
        page.get_by_role('button',name='기능 추가',exact=True).click()
        page.get_by_placeholder('예: 실시간 QR 출석 체크').fill('T10 after middle delete')
        page.get_by_role('button',name='기능 등록',exact=True).click();saved(page)
        after=api(setup,'GET',path)['data'];features=after['payload']['features']
        assert len(features)==3 and len({f['id'] for f in features})==3
        assert features[-1]['displayCode']=='FEAT-04';UUID(features[-1]['id'])
        assert features[0]['id']==before['payload']['features'][0]['id'] and features[1]['id']==before['payload']['features'][2]['id']
        assert after['payload']['tables']==before['payload']['tables']
        remote,_=workspace(b,origin,title=TITLE,login_id='auth-b',project_id=pid)
        remote.get_by_role('button',name=STEP,exact=True).click()
        # Both product contexts create from the same base before allowing either PUT to reach the server.
        held=[]
        for current in [page,remote]:
            current.route('**'+path,lambda route: held.append(route) if route.request.method=='PUT' else route.continue_())
        for current,name in [(page,'T10 concurrent A'),(remote,'T10 concurrent B')]:
            current.get_by_role('button',name='기능 추가',exact=True).click()
            current.get_by_placeholder('예: 실시간 QR 출석 체크').fill(name)
            current.get_by_role('button',name='기능 등록',exact=True).click()
        page.wait_for_timeout(700)
        assert len(held)==2
        for route in held:route.continue_()
        for current in [page,remote]:current.unroute('**'+path)
        for current in [page,remote]:saved(current)
        final=api(setup,'GET',path)['data'];names={f['name'] for f in final['payload']['features']}
        assert {'T10 concurrent A','T10 concurrent B'}<=names
        assert len({f['id'] for f in final['payload']['features']})==5
        assert len({f['displayCode'] for f in final['payload']['features']})==5
        assert final['payload']['tables']==before['payload']['tables']
    finally:a.close();b.close()

def test_feat_api_download_uses_edited_method_body_codes_and_one_yaml_path(browser_session):
    browser,origin=browser_session;context=browser.new_context()
    try:
        page,setup,pid,path=setup_case(context,origin)
        body=save_request(api(setup,'GET',path)['data']);feature=body['payload']['features'][0]
        feature.update(name='Quoted "API"',responseStatusCodes=['201 Created','409 Conflict'])
        body['payload']['features'].append(dict(feature,id=str(uuid4()),method='GET',name='Read API'))
        assert api(setup,'PUT',path,body)['status']==200
        reopen(page,origin);page.get_by_role('button',name='API 명세서 자동화',exact=True).click()
        with page.expect_download() as result:page.get_by_role('button',name='다운로드',exact=True).click()
        value=json.loads(Path(result.value.path()).read_text(encoding='utf-8'))
        paths=value['paths'];assert len(paths)==1
        assert set(paths[feature['endpoint']])=={'post','get'}
        assert set(paths[feature['endpoint']]['post']['responses'])=={'201','409'}
        assert paths[feature['endpoint']]['post']['requestBody']['content']['application/json']['schema']['example']==feature['requestFields']
        assert 'requestBody' not in paths[feature['endpoint']]['get']
        page.get_by_role('button',name='Swagger YAML',exact=True).click()
        with page.expect_download() as result:page.get_by_role('button',name='다운로드',exact=True).click()
        yaml=Path(result.value.path()).read_text(encoding='utf-8')
        assert yaml.count(feature['endpoint'])==1 and '201' in yaml and '409' in yaml
        assert 'Quoted \\"API\\"' in yaml
        page.screenshot(path=str(Path(__file__).resolve().parents[2]/'.local/w11-t10-api.png'))
    finally:context.close()
