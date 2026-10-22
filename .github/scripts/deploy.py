"""Publish tested images and deploy by digest, with no production secrets in files.

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

from frontend_artifact import digest
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


def render(images):
    docs = json.loads(Path('.cloudtype/services.json').read_text(encoding='utf-8'))
    assert {doc['name'] for doc in docs} == {'frontend', 'syncarch-api'}
    for doc in docs:
        image = images['backend' if doc['name'] == 'syncarch-api' else 'frontend']
        if not re.fullmatch(r'ghcr\.io/[a-z0-9_./-]+@sha256:[0-9a-f]{64}', image):
            raise ValueError('Cloudtype must deploy immutable GHCR image digests')
        doc['options']['image'] = image
    return docs


def publish():
    manifest = json.loads(Path('.local/release-manifest.json').read_text(encoding='utf-8'))
    sha = os.environ['GITHUB_SHA']
    assert manifest['revision'] == sha, 'Release artifact belongs to another source revision'
    assert digest(Path('.local/release-images.tar')) == manifest['archiveSha256'], 'Release archive changed'
    subprocess.run(['docker', 'load', '-i', '.local/release-images.tar'], check=True)
    images = {}
    for service in ('frontend', 'backend'):
        expected = manifest['images'][service]
        details = json.loads(subprocess.check_output(['docker', 'image', 'inspect', expected['name']], text=True))[0]
        assert details['Id'] == expected['id']
        assert details['Config']['Labels']['org.opencontainers.image.revision'] == sha
        target = 'ghcr.io/' + os.environ['GITHUB_REPOSITORY'].lower() + '-' + service + ':' + sha
        subprocess.run(['docker', 'tag', expected['id'], target], check=True)
        pushed = subprocess.run(['docker', 'push', target], text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, check=True).stdout
        match = re.search(r'digest: (sha256:[0-9a-f]{64})', pushed)
        assert match, 'Registry did not return an immutable manifest digest'
        image = target.rsplit(':', 1)[0] + '@' + match[1]
        subprocess.run(['docker', 'pull', image], check=True)
        actual = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True))[0]
        assert actual['Id'] == expected['id'], 'Published image differs from the tested container'
        images[service] = image
    Path('.local/published-images.json').write_text(json.dumps({'revision': sha, 'images': images}, indent=2), encoding='utf-8')
    return images


def deploy(images):
    docs = render(images)
    Path('.local/cloudtype-release.json').write_text(json.dumps(docs, indent=2), encoding='utf-8')
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
    print('Cloudtype accepted frontend/backend immutable images; public smoke is still required')


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['preflight']:
        preflight()
    else:
        preflight()
        deploy(publish())
