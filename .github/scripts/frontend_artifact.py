"""Bind the production frontend files to the exact checkout SHA."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(root):
    return {p.relative_to(root).as_posix(): digest(p) for p in sorted(root.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('create', 'verify'))
    parser.add_argument('sha')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.sha):
        raise SystemExit('Expected a full source commit SHA')
    root = Path('frontend/dist')
    manifest = Path('.local/frontend-manifest.json')
    if args.mode == 'create':
        assert (root / 'index.html').is_file(), 'No production frontend build'
        (root / 'release.json').write_text(json.dumps({'revision': args.sha}) + '\n', encoding='utf-8')
        manifest.parent.mkdir(exist_ok=True)
        manifest.write_text(json.dumps({'revision': args.sha, 'files': inventory(root)}, indent=2), encoding='utf-8')
    else:
        expected = json.loads(manifest.read_text(encoding='utf-8'))
        assert expected['revision'] == args.sha, 'Frontend belongs to another source revision'
        assert expected['files'] == inventory(root), 'Frontend files changed after the required build'
    print('Frontend artifact verified for ' + args.sha)


if __name__ == '__main__':
    main()
