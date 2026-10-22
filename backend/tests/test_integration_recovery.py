"""W11 TC-QUAL-01/SAFE-02: five real HTTP sessions and dump restore on disposable MariaDB."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import AppUser
from test_auth import auth_app, PASSWORD
from test_auth_browser import browser_session

ROOT = Path(__file__).resolve().parents[2]


def http(origin, token, method, path, body=None, headers=None):
    started = time.perf_counter()
    request = Request(origin + path, method=method, data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', **(headers or {})})
    try:
        response = urlopen(request, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None, dict(response.headers), (time.perf_counter()-started)*1000


def sessions(auth_app, origin):
    with auth_app.app_context():
        for n in range(3):
            db.session.add(AppUser(login_id=f'w11-{n}', display_name=f'W11 {n}', password_hash=generate_password_hash(PASSWORD)))
        db.session.commit()
    tokens=[]
    for name in ['auth-a', 'auth-b', 'w11-0', 'w11-1', 'w11-2']:
        response=auth_app.test_client().post('/api/auth/login', json={'loginId':name,'password':PASSWORD},headers={'Origin':origin})
        assert response.status_code==200
        tokens.append(response.json['data']['accessToken'])
    return tokens


def body(view):
    return {'baseVersion':view['version'],'mutationId':str(uuid4()),
            'project':{k:view['project'][k] for k in ['title','summary','categoryTag','targetDbms']},'payload':deepcopy(view['payload'])}


@pytest.mark.mariadb
def test_five_sessions_100_nodes_100_lines_measure_consistency_and_etag(browser_session, auth_app):
    """TC-QUAL-01/COL-02/05: local HTTP timings, actual 409 rebase and conditional reads."""
    _, origin=browser_session
    tokens=sessions(auth_app,origin)
    status,data,_,_=http(origin,tokens[0],'POST','/api/projects',{'title':'W11 measurement'})
    assert status==201
    pid=data['data']['id']; path=f'/api/projects/{pid}/document'
    for name in ['auth-b','w11-0','w11-1','w11-2']:
        assert http(origin,tokens[0],'POST',f'/api/projects/{pid}/members',{'loginId':name})[0]==200
    initial=http(origin,tokens[0],'GET',path)[1]['data']; request=body(initial)
    nodes=[{'id':str(uuid4()),'name':f'Node {n}','category':'Service','techStack':[],'description':'','x':20+n%10*110,'y':20+n//10*70} for n in range(100)]
    request['payload']['nodes']=nodes
    request['payload']['connections']=[{'id':str(uuid4()),'sourceId':nodes[n]['id'],'targetId':nodes[(n+1)%100]['id'],'protocol':'REST','label':f'line{n}'} for n in range(100)]
    size=len(json.dumps(request).encode()); assert size<1024*1024
    assert http(origin,tokens[0],'PUT',path,request)[0]==200
    def worker(index):
        measurements=[]; conflicts=0
        for cycle in range(3):
            for attempt in range(15):
                status,result,headers,elapsed=http(origin,tokens[index],'GET',path)
                assert status==200
                measurements.append(('GET',status,elapsed))
                conditional=http(origin,tokens[index],'GET',path,headers={'If-None-Match':headers['ETag']})
                assert conditional[0] in (200,304)
                measurements.append(('conditional',conditional[0],conditional[3]))
                request=body(result['data']); request['payload']['nodes'][index]['description']=f'actor{index}-cycle{cycle}'
                status,_,_,elapsed=http(origin,tokens[index],'PUT',path,request)
                measurements.append(('PUT',status,elapsed))
                if status==200:break
                assert status==409; conflicts+=1
            else: raise AssertionError('CAS did not settle in bounded retries')
        return measurements,conflicts
    with ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(worker,range(5)))
    final=http(origin,tokens[0],'GET',path)[1]['data']
    assert final['version']==initial['version']+1+15
    assert len(final['payload']['nodes'])==100 and len(final['payload']['connections'])==100
    for index in range(5):assert final['payload']['nodes'][index]['description']==f'actor{index}-cycle2'
    measurements=[m for rows,_ in results for m in rows]
    report={'environment':'localhost threaded Flask / actual MariaDB11.4 / Redis; five independently authenticated API sessions, not five product browser tabs',
        'payloadBytes':size,'nodes':100,'connections':100,'writes':15,'conflicts':sum(c for _,c in results),
        'requestCount':len(measurements),'notModified':sum(s==304 for _,s,_ in measurements),
        'conditionalCount':sum(m=='conditional' for m,_,_ in measurements),'maxMs':{kind:max(ms for m,_,ms in measurements if m==kind) for kind in ['GET','PUT','conditional']},
        'initialTargetMs':2000,'samples':[{'kind':m,'status':s,'ms':round(ms,3)} for m,s,ms in measurements]}
    (ROOT/'.local/w11-performance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    assert all(value<=2000 for value in report['maxMs'].values()),'Local initial 2s target missed; see measurements'


@pytest.mark.mariadb
def test_dump_restore_to_separate_database_and_fresh_flask_preserves_document_and_auth(browser_session, auth_app, tmp_path):
    """TC-SAFE-02/SAVE-04: actual mariadb-dump and import, original DB is untouched."""
    _,origin=browser_session
    tokens=sessions(auth_app,origin)
    status,data,_,_=http(origin,tokens[0],'POST','/api/projects',{'title':'W11 restore'})
    assert status==201
    pid=data['data']['id'];path=f'/api/projects/{pid}/document'
    request=body(http(origin,tokens[0],'GET',path)[1]['data']);request['project']['summary']='survives dump restore'
    status,saved,_,_=http(origin,tokens[0],'PUT',path,request);assert status==200
    assert http(origin,tokens[0],'POST',f'/api/projects/{pid}/messages',{'body':'restored chat'})[0]==201
    before=http(origin,tokens[0],'GET',path)[1]
    with auth_app.app_context():url=db.engine.url; names=inspect(db.engine).get_table_names()
    assert re.fullmatch(r'syncarch_test_[a-f0-9]{32}',url.database or '')
    binary=Path(os.environ.get('TEST_MARIADB_BIN',ROOT/'.local/w08-tools/mariadb-11.4.13-winx64/bin'))
    assert (binary/'mariadb-dump.exe').is_file(),'TEST_MARIADB_BIN must point to MariaDB11.4 tools'
    config=tmp_path/'client.cnf'
    config.write_text(f'[client]\nhost={url.host}\nport={url.port}\nuser={url.username}\npassword={url.password}\nprotocol=tcp\ndefault-character-set=utf8mb4\n',encoding='utf-8')
    dump=tmp_path/'restore.sql'
    with dump.open('wb') as output:
        result=subprocess.run([str(binary/'mariadb-dump.exe'),f'--defaults-extra-file={config}','--single-transaction','--skip-comments',url.database],stdout=output,stderr=subprocess.PIPE)
    assert result.returncode==0,'mariadb-dump failed (credentials suppressed)'
    target='syncarch_test_'+uuid4().hex;admin=create_engine(url.set(database=None),isolation_level='AUTOCOMMIT');restored=None
    try:
        with admin.connect() as c:c.exec_driver_sql(f'CREATE DATABASE `{target}` CHARACTER SET utf8mb4')
        with dump.open('rb') as source:
            result=subprocess.run([str(binary/'mariadb.exe'),f'--defaults-extra-file={config}',target],stdin=source,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert result.returncode==0,'MariaDB restore failed (credentials suppressed)'
        restored=create_app({'TESTING':True,'SQLALCHEMY_DATABASE_URI':url.set(database=target),'JWT_SECRET_KEY':auth_app.config['JWT_SECRET_KEY'],'ALLOWED_ORIGINS':[origin]})
        restored.extensions['token_repository']=auth_app.extensions['token_repository']
        client=restored.test_client();headers={'Authorization':'Bearer '+tokens[0]}
        assert client.get(path,headers=headers).json==before
        assert client.get('/api/auth/me',headers=headers).status_code==200
        messages=client.get(f'/api/projects/{pid}/messages',headers=headers)
        assert messages.status_code==200 and 'restored chat' in json.dumps(messages.json)
        replay=client.put(path,json=request,headers=headers)
        assert replay.status_code==200 and replay.json['data']['replayed'] is True
        with restored.app_context():
            assert inspect(db.engine).get_table_names()==names
            restored_counts={name:db.session.execute(text(f'SELECT COUNT(*) FROM `{name}`')).scalar() for name in names}
        with auth_app.app_context():
            assert restored_counts=={name:db.session.execute(text(f'SELECT COUNT(*) FROM `{name}`')).scalar() for name in names}
        assert http(origin,tokens[0],'GET',path)[1]==before
        (ROOT/'.local/w11-restore.json').write_text(json.dumps({'dumpBytes':dump.stat().st_size,'tables':restored_counts,'documentVersion':before['data']['version'],'freshFlaskDocumentEqual':True,'authAndChat':True,'mutationReplay':True,'originalUnchanged':True},indent=2),encoding='utf-8')
    finally:
        if restored:
            with restored.app_context():db.session.remove();db.engine.dispose()
        with admin.connect() as c:c.exec_driver_sql(f'DROP DATABASE `{target}`')
        admin.dispose()
        config.unlink(missing_ok=True)
