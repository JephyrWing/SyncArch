"""W11/COL07: same-timestamp pagination and durable idempotency without a new table."""
from datetime import datetime
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select, func
from app.extensions import db
from app.models import ProjectMessage
from test_auth import auth_app
from test_projects import users, create, add_editor


def test_same_timestamp_450_messages_cursor_and_replay_permissions(users):
    pid=create(users)['id'];add_editor(users,pid)
    path=f'/api/projects/{pid}/messages';owner=users['owner'];headers=users['owner_headers']
    stamp=datetime(2026,1,1,0,0,0)
    ids=sorted(str(uuid4()) for _ in range(450))
    with users['app'].app_context():
        db.session.add_all([ProjectMessage(id=value,project_id=pid,user_id=users['owner_id'],body=f'bulk-{i}',created_at=stamp) for i,value in enumerate(ids)])
        db.session.commit()
    collected=[];since='1970-01-01T00:00:00Z';after=None
    while True:
        response=owner.get(path,query_string={'since':since,**({'afterId':after} if after else {})},headers=headers)
        assert response.status_code==200
        page=response.json['data'];collected.extend(page)
        if len(page)<200:break
        since,after=page[-1]['createdAt'],page[-1]['id']
    assert [m['id'] for m in collected]==ids
    key=str(uuid4());payload={'body':'exactly once','messageId':key}
    first=owner.post(path,json=payload,headers=headers);assert first.status_code==201
    assert owner.post(path,json=payload,headers=headers).json==first.json
    assert owner.post(path,json={**payload,'body':'other'},headers=headers).status_code==409
    assert users['editor'].post(path,json=payload,headers=users['editor_headers']).status_code==409
    other=create(users,'Other project')['id']
    assert owner.post(f'/api/projects/{other}/messages',json=payload,headers=headers).status_code==409
    assert users['outsider'].get(path,query_string={'since':since,'afterId':after},headers=users['outsider_headers']).status_code==404
    assert owner.get(path,query_string={'afterId':key},headers=headers).status_code==400
    assert owner.post(path,json={'body':'x','messageId':'not-a-uuid'},headers=headers).status_code==400
    owner.delete(f'/api/projects/{pid}/members/{users["editor_id"]}',headers=headers)
    assert users['editor'].post(path,json=payload,headers=users['editor_headers']).status_code==404
    with users['app'].app_context():
        assert db.session.scalar(select(func.count()).select_from(ProjectMessage).where(ProjectMessage.project_id==pid))==451


@pytest.mark.mariadb
def test_same_chat_key_concurrent_requests_have_one_row(users):
    pid=create(users)['id'];payload={'body':'one concurrent message','messageId':str(uuid4())}
    def post(_):
        with users['app'].test_client() as client:
            response=client.post(f'/api/projects/{pid}/messages',json=payload,headers=users['owner_headers'])
            return response.status_code,response.json
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(post,range(2)))
    assert results[0]==results[1] and results[0][0]==201
    with users['app'].app_context():
        assert db.session.scalar(select(func.count()).select_from(ProjectMessage).where(ProjectMessage.project_id==pid))==1
