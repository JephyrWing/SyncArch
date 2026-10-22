"""W11 T04: actual commit followed by a lost HTTP response and product retry."""
import time
from pathlib import Path
import json
from playwright.sync_api import expect

from test_auth import auth_app
from test_auth_browser import browser_session, open_page, sign_in
from test_workspace_browser import workspace, SUMMARY
from test_projects_browser import api
from test_documents_browser import save_request
from app.extensions import db
from app.models import ProjectMessage
from datetime import datetime
from uuid import uuid4


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


def test_chat_product_drains_450_equal_timestamps_and_retries_lost_post(browser_session,auth_app):
    browser,origin=browser_session;context=browser.new_context()
    try:
        page,pid=workspace(context,origin,title='W11 chat recovery')
        setup=open_page(context,origin);sign_in(setup)
        with auth_app.app_context():
            db.session.add_all([ProjectMessage(project_id=pid,user_id=auth_app.config['TEST_AUTH_USER'],body=f'bulk-{i}',created_at=datetime(2026,1,1)) for i in range(450)])
            db.session.commit()
        page.get_by_role('button',name='팀 채팅 열기',exact=False).click()
        chat=page.get_by_role('region',name='팀 채팅',exact=True)
        expect(chat.get_by_text('bulk-',exact=False)).to_have_count(450,timeout=20000)
        path=f'/api/projects/{pid}/messages';writes=[]
        def lose(route):
            if route.request.method!='POST':route.continue_();return
            writes.append(route.request.post_data_json)
            if len(writes)==1:
                assert route.fetch().status==201
                route.abort('failed')
            else:route.continue_()
        page.route('**'+path,lose)
        chat.get_by_label('메시지',exact=True).fill('lost chat response')
        chat.get_by_role('button',name='보내기',exact=True).click()
        expect(chat.get_by_role('alert')).to_be_visible()
        chat.get_by_role('button',name='보내기',exact=True).click()
        expect(chat.get_by_label('메시지',exact=True)).to_have_value('')
        assert len(writes)==2 and writes[0]==writes[1]
        expect(chat.get_by_text('lost chat response',exact=True)).to_have_count(1)
        history=api(setup,'GET',path+'?since=1970-01-01T00:00:00Z')['data']
        assert len(history)==200  # pagination remains bounded
        with auth_app.app_context():
            assert db.session.query(ProjectMessage).filter_by(project_id=pid,body='lost chat response').count()==1
    finally:context.close()


def test_offline_draft_rebase_and_hidden_poll_resume_preserve_remote_fields(browser_session):
    """COL05: real network offline, then hidden-state-controlled polling and focus recovery."""
    browser,origin=browser_session;first,second=browser.new_context(),browser.new_context()
    try:
        owner,pid=workspace(first,origin,title='W11 network recovery')
        setup=open_page(first,origin);sign_in(setup)
        assert api(setup,'POST',f'/api/projects/{pid}/members',{'loginId':'auth-b'})['status']==200
        remote=open_page(second,origin);sign_in(remote,'auth-b')
        path=f'/api/projects/{pid}/document'
        first.set_offline(True)
        owner.get_by_placeholder(SUMMARY).fill('offline local draft')
        expect(owner.get_by_role('status').filter(has_text='저장 실패')).to_be_visible()
        changed=save_request(api(remote,'GET',path)['data'])
        changed['payload']['nodes']=[{'id':str(uuid4()),'name':'remote preserved node','category':'Service','techStack':[],'description':'remote edit','x':20,'y':20}]
        assert api(remote,'PUT',path,changed)['status']==200
        first.set_offline(False)
        owner.get_by_role('button',name='다시 시도',exact=True).click()
        expect(owner.get_by_role('status').filter(has_text='저장됨')).to_be_visible(timeout=15000)
        expect(owner.get_by_placeholder(SUMMARY)).to_have_value('offline local draft')
        saved=api(remote,'GET',path)['data']
        assert saved['payload']['nodes'][0]['name']=='remote preserved node'
        assert saved['project']['summary']=='offline local draft'
        reads=[]
        owner.on('request',lambda r:reads.append(r.url) if r.method=='GET' and r.url.endswith('/document') else None)
        owner.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})")
        owner.wait_for_timeout(1200);reads.clear()
        changed=save_request(saved);changed['project']['summary']='visible after focus'
        assert api(remote,'PUT',path,changed)['status']==200
        owner.wait_for_timeout(2200)
        assert reads==[]
        owner.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});window.dispatchEvent(new Event('focus'))")
        expect(owner.get_by_placeholder(SUMMARY)).to_have_value('visible after focus',timeout=10000)
        assert reads
    finally:
        first.set_offline(False);first.close();second.close()
