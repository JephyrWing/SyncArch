"""W11 T04: actual commit followed by a lost HTTP response and product retry."""
import time
from pathlib import Path
import json
from playwright.sync_api import expect

from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in
from test_workspace_browser import workspace, SUMMARY
from test_projects_browser import api


def test_commit_response_loss_retry_same_key_single_activity_and_remote_visibility(browser_session):
    browser,origin=browser_session
    first,second=browser.new_context(),browser.new_context()
    try:
        owner,pid=workspace(first,origin,title='W11 response loss')
        setup=open_page(first,origin);sign_in(setup)
        assert api(setup,'POST',f'/api/projects/{pid}/members',{'loginId':'auth-b'})['status']==200
        editor,_=workspace(second,origin,title='W11 response loss',login_id='auth-b',project_id=pid)
        path=f'/api/projects/{pid}/document'
        before=api(setup,'GET',path)['data']
        writes=[]
        def lose_first(route):
            if route.request.method!='PUT':route.continue_();return
            writes.append(route.request.post_data_json)
            if len(writes)==1:
                response=route.fetch()
                assert response.status==200
                route.abort('failed')
            else:route.continue_()
        owner.route('**'+path,lose_first)
        started=time.perf_counter()
        owner.get_by_placeholder(SUMMARY).fill('committed despite lost response')
        expect(owner.get_by_role('status').filter(has_text='저장 실패')).to_be_visible()
        committed=api(setup,'GET',path)['data']
        assert committed['version']==before['version']+1
        owner.get_by_role('button',name='다시 시도',exact=True).click()
        expect(owner.get_by_role('status').filter(has_text='저장됨')).to_be_visible(timeout=15000)
        assert len(writes)==2 and writes[0]==writes[1]
        editor.bring_to_front()
        expect(editor.get_by_placeholder(SUMMARY)).to_have_value('committed despite lost response',timeout=10000)
        elapsed=(time.perf_counter()-started)*1000
        assert api(setup,'GET',path)['data']['version']==committed['version']
        activity=api(setup,'GET',f'/api/projects/{pid}/activity')['data']['items']
        assert sum(item['version']==committed['version'] for item in activity)==1
        (Path(__file__).resolve().parents[2]/'.local/w11-response-loss.json').write_text(json.dumps({'singleCommit':True,'identicalRequestRetry':True,'twoIndependentContexts':True,'singleActivity':True,'editToRemoteVisibleIncludingExplicitRetryMs':elapsed}),encoding='utf-8')
    finally:
        first.close();second.close()
