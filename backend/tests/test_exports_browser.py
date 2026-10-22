"""W10 TC-OUT-01/02, QUAL-02: actual saved document -> download -> separate MariaDB."""
from pathlib import Path
from uuid import uuid4
import os
import re

import pytest
from playwright.sync_api import expect
from sqlalchemy import create_engine, inspect, text
from app.extensions import db

from test_auth import auth_app
from test_auth_browser import browser_session
from test_architecture_browser import fixture, document, enter
from test_documents_browser import save_request
from test_projects_browser import api
from test_workspace_browser import SUMMARY, error_response


def export_fixture(context, origin):
    page, setup, pid, nodes, connections = fixture(context, origin)
    body = save_request(document(setup, pid))
    root, child, feature = str(uuid4()), str(uuid4()), str(uuid4())
    body['project']['targetDbms'] = 'mariadb'
    body['payload']['ideas'] = [
        {'id': root, 'title': 'Root | idea', 'category': 'problems_goals', 'decisionStatus': 'ACCEPTED', 'decisionReason': 'Root decision'},
        {'id': child, 'title': 'Hidden child', 'parentIdeaId': root, 'category': 'problems_goals', 'decisionReason': 'Hidden decision'}]
    body['payload']['features'] = [{'id': feature, 'name': 'Export feature', 'method': 'GET', 'endpoint': '/exports', 'relatedStoryId': child}]
    body['payload']['connections'][0]['description'] = 'Saved connection details'
    def col(name, kind, **extra):
        return {'id': str(uuid4()), 'name': name, 'dataType': kind, 'isPrimaryKey': False, 'isForeignKey': False, 'isNullable': True, 'isUnique': False, 'comment': "it's saved", **extra}
    def table(name, columns):
        return {'id': str(uuid4()), 'name': name, 'comment': "owner's table", 'columns': columns, 'relatedFeatureIds': [feature], 'x': 0, 'y': 0}
    body['payload']['tables'] = [
        table('children', [col('id', 'UUID', isPrimaryKey=True, isNullable=False), col('parent_id', 'UUID', isForeignKey=True, references='order.select')]),
        table('order', [col('select', 'UUID', isPrimaryKey=True, isNullable=False), col('label', 'VARCHAR', length=120),
                        col('amount', 'DECIMAL', precision=12, scale=2, defaultValue='0'), col('whole', 'DECIMAL', precision=12, scale=0), col('moment', 'DATETIME', precision=6)])]
    result = api(setup, 'PUT', f'/api/projects/{pid}/document', body)
    assert result['status'] == 200, result
    enter(page, origin)
    return page, setup, pid


@pytest.mark.mariadb
def test_exports_saved_version_markdown_sql_apply_and_app_db_protection(browser_session, auth_app, tmp_path):
    browser, origin = browser_session
    context = browser.new_context(viewport={'width': 1600, 'height': 1000}, accept_downloads=True)
    try:
        page, setup, pid = export_fixture(context, origin)
        stored = document(setup, pid)
        with auth_app.app_context():
            app_schema = inspect(db_engine := db.engine).get_table_names()
            app_url = db_engine.url
        page.get_by_role('button', name='내보내기 (SQL / MD)', exact=True).click()
        expect(page.get_by_text(f'저장 버전 {stored["version"]} ·', exact=False)).to_be_visible()
        page.get_by_role('button', name='MariaDB 11', exact=True).click()
        with page.expect_download() as download:
            page.get_by_role('button', name='schema-mariadb.sql 다운로드').click()
        ddl = Path(download.value.path()).read_text(encoding='utf-8')
        assert f'-- Saved Version: {stored["version"]}' in ddl
        assert ddl.index('CREATE TABLE `order`') < ddl.index('CREATE TABLE `children`')
        # Remote saves while the modal is open cannot mix SQL and Markdown versions.
        changed = save_request(stored)
        changed['project']['summary'] = 'remote change after export snapshot'
        assert api(setup, 'PUT', f'/api/projects/{pid}/document', changed)['status'] == 200
        page.get_by_role('button', name='Markdown 명세서 (Mermaid)').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='ARCHITECTURE_SPEC.md 다운로드').click()
        md = Path(download.value.path()).read_text(encoding='utf-8')
        for fragment in ['Hidden child', 'Hidden decision', 'Root decision', 'Export feature', 'Saved connection details', 'VARCHAR(120)', 'DECIMAL(12,0)', f'saved version: {stored["version"]}']:
            assert fragment in md, fragment
        assert stored['payload']['ideas'][0]['id'] in md
        assert stored['payload']['ideas'][1]['id'] in md
        assert 'remote change after export snapshot' not in md
        assert 'FEAT-01: 사내 SSO' not in md
        assert document(setup, pid)['version'] == stored['version'] + 1
        assert api(setup, 'POST', f'/api/projects/{pid}/execute-sql', {'sql': ddl})['status'] in (404,405)
        with auth_app.app_context():
            assert inspect(db_engine).get_table_names() == app_schema
        # A second database on the disposable test server, never the app database.
        assert app_url.get_backend_name() == 'mysql'
        assert re.fullmatch(r'syncarch_test_[a-f0-9]{32}', app_url.database)
        target = 'syncarch_test_' + uuid4().hex
        admin = create_engine(app_url.set(database=None), isolation_level='AUTOCOMMIT')
        applied = None
        try:
            with admin.connect() as c: c.exec_driver_sql(f'CREATE DATABASE `{target}` CHARACTER SET utf8mb4')
            applied = create_engine(app_url.set(database=target))
            with applied.begin() as c:
                # This fixture has no semicolons inside literals.
                for statement in ddl.split(';'):
                    if statement.strip(): c.exec_driver_sql(statement)
                columns = {r.COLUMN_NAME: r for r in c.execute(text('SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,DATETIME_PRECISION,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=:s AND TABLE_NAME=:t'), {'s':target,'t':'order'})}
                assert columns['select'].DATA_TYPE == 'char' and columns['select'].CHARACTER_MAXIMUM_LENGTH == 36
                assert columns['label'].CHARACTER_MAXIMUM_LENGTH == 120
                assert (columns['amount'].NUMERIC_PRECISION,columns['amount'].NUMERIC_SCALE) == (12,2)
                assert columns['whole'].NUMERIC_SCALE == 0
                assert columns['moment'].DATETIME_PRECISION == 6
                assert columns['label'].COLUMN_COMMENT == "it's saved"
            assert inspect(applied).get_pk_constraint('order')['constrained_columns'] == ['select']
            assert inspect(applied).get_foreign_keys('children')[0]['referred_table'] == 'order'
        finally:
            if applied: applied.dispose()
            with admin.connect() as c: c.exec_driver_sql(f'DROP DATABASE `{target}`')
            admin.dispose()
        output = Path(__file__).resolve().parents[2] / '.local'
        (output/'w10-saved.sql').write_text(ddl, encoding='utf-8')
        (output/'w10-saved.md').write_text(md, encoding='utf-8')
    finally:
        context.close()


def test_exports_refuse_unsaved_draft_and_failed_read(browser_session):
    browser, origin = browser_session
    context = browser.new_context(viewport={'width':1600,'height':1000})
    try:
        page, setup, pid = export_fixture(context, origin)
        page.get_by_role('button', name='Step 1. 아이디어 보드', exact=True).click()
        page.route(f'**/api/projects/{pid}/document', lambda r: error_response(r,503,'DB_UNAVAILABLE') if r.request.method == 'PUT' else r.continue_())
        page.get_by_placeholder(SUMMARY).fill('not committed')
        expect(page.get_by_role('status').filter(has_text='저장 실패')).to_be_visible()
        page.get_by_role('button', name='내보내기 (SQL / MD)', exact=True).click()
        expect(page.get_by_role('alert').filter(has_text='저장이 완료된 뒤')).to_be_visible()
        expect(page.get_by_role('button',name='schema-mariadb.sql 다운로드')).to_be_disabled()
        page.get_by_role('button',name='내보내기 닫기').click()
        page.unroute(f'**/api/projects/{pid}/document')
        page.once('dialog', lambda d:d.accept())
        page.reload()
        enter(page,origin)
        page.route(f'**/api/projects/{pid}/document',lambda r:error_response(r,503,'DB_UNAVAILABLE'))
        page.get_by_role('button', name='내보내기 (SQL / MD)', exact=True).click()
        expect(page.get_by_role('alert').filter(has_text='저장본을 불러오지 못했습니다')).to_be_visible()
        expect(page.get_by_role('button',name='schema-mariadb.sql 다운로드')).to_be_disabled()
    finally:
        context.close()
