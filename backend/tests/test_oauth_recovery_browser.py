"""W11 real-provider finding: failed browser callbacks must consume the sensitive URL."""
from unittest.mock import patch
import pytest
from playwright.sync_api import expect
from app.errors import GoogleLinkRequired, GoogleAuthenticationFailed
from test_auth import auth_app
from test_auth_browser import browser_session
from test_social_auth import google_app, signer, certificate_transport


@pytest.mark.parametrize('failure',[GoogleLinkRequired,GoogleAuthenticationFailed])
def test_oauth_failure_browser_clears_code_url_and_preserves_json_api_contract(browser_session,google_app,failure):
    browser,origin=browser_session;app=google_app.app
    app.config['AUTH_FRONTEND_ORIGIN']=origin
    context=browser.new_context()
    try:
        with patch('app.services.social_auth_service.finish_google',side_effect=failure()):
            api=app.test_client().get('/api/auth/google/callback?state=failed-state&code=consumed-code',headers={'Accept':'application/json'})
            assert api.status_code==failure.status and api.json['error']['code']==failure.code
            page=context.new_page()
            page.goto(origin+'/api/auth/google/callback?state=failed-state&code=consumed-code')
            expect(page.get_by_role('heading',name='팀 설계 공간에 로그인')).to_be_visible()
            expect(page.get_by_role('alert')).to_contain_text('Google')
            expect(page).to_have_url(origin+'/')
            assert 'consumed-code' not in page.url and 'failed-state' not in page.url
            assert all(c['name']!='syncarch_google_binding' for c in context.cookies())
    finally:context.close()
