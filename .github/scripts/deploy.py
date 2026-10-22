"""Deploy the main branch; verify its public revision against the passing CI run.

Cloudtype request contract follows the official deploy action at
cloudtype-github-actions/deploy@43cf563907c5451c12ecc4461bdbf02e61528d1d/src/action.ts.
Its action.yml still requires Node 12; use the same HTTP contract on Python 3.12.
"""
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from smoke import NoRedirect


def preflight():
    for name in ('CLOUDTYPE_TOKEN', 'DEPLOY_URL', 'SMOKE_LOGIN_ID', 'SMOKE_PASSWORD'):
        if not os.environ.get(name):
            raise ValueError('Missing deployment setting: ' + name)
    url = urlsplit(os.environ['DEPLOY_URL'])
    if url.scheme != 'https' or not url.netloc or url.path or url.query or url.fragment or url.username:
        raise ValueError('DEPLOY_URL must be an exact HTTPS origin without trailing slash')
    if os.getenv('GITHUB_EVENT_NAME') != 'push' or os.getenv('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Deployment is restricted to main pushes')
    head = subprocess.check_output(['git', 'ls-remote', 'origin', 'refs/heads/main'], text=True).split()[0]
    if head != os.environ['GITHUB_SHA']:
        raise ValueError('Superseded release: main has advanced; deploy the latest successful run')


def render(sha):
    if not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Release revision must be a full Git commit SHA')
    docs = json.loads(Path('.cloudtype/services.json').read_text(encoding='utf-8'))
    assert {doc['name'] for doc in docs} == {'syncarch-web', 'syncarch-api'}
    for doc in docs:
        assert doc['app'] == 'dockerfile'
        assert doc['context']['git']['url'] == 'https://github.com/JephyrWing/SyncArch.git'
        # Cloudtype's generated workflow sends github.ref (refs/heads/main).
        # A bare "main" is not retained as the branch in its service settings.
        doc['context']['git']['ref'] = 'refs/heads/main'
        doc['options']['env'].append({'name': 'RELEASE_SHA', 'value': sha})
    return docs


def deploy(sha):
    docs = render(sha)
    output = Path('.local/cloudtype-release.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(docs, indent=2), encoding='utf-8')
    request = Request('https://app.cloudtype.io/api/project/gad03302/syncarch/deploy', method='PUT',
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['CLOUDTYPE_TOKEN']},
        data=json.dumps({'request': docs, 'stages': ['main']}).encode())
    try:
        with build_opener(NoRedirect()).open(request, timeout=60) as response:
            raw = response.read()
            result = json.loads(raw) if raw else None
            if response.status not in (200, 204) or isinstance(result, dict) and result.get('error'):
                raise RuntimeError('Cloudtype rejected deployment; inspect its service events')
    except (HTTPError, URLError):
        raise RuntimeError('Cloudtype deployment failed; response contents suppressed') from None
    print('Cloudtype accepted the main branch deployment; source rebuild and public smoke are still required')


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['preflight']:
        preflight()
    else:
        preflight()
        deploy(os.environ['GITHUB_SHA'])
