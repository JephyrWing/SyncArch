"""Negative cases for release gates; independent of the product test environment."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from check_junit import validate
from deploy import deploy, preflight, render


class ReleaseGateTests(unittest.TestCase):
    def report(self, xml):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'report.xml'
            path.write_text(xml, encoding='utf-8')
            return validate(path)

    def test_only_actual_success_is_accepted(self):
        self.assertEqual(self.report('<testsuites><testsuite><testcase name="real"/></testsuite></testsuites>'), 1)

    def test_zero_collection_and_unsuccessful_results_block(self):
        for xml in ('<testsuites/>', *[f'<testsuite><testcase><{tag}/></testcase></testsuite>'
                                        for tag in ('skipped', 'error', 'failure')]):
            with self.subTest(xml=xml), self.assertRaises(ValueError):
                self.report(xml)

    def test_malformed_or_missing_reports_block(self):
        with self.assertRaises(Exception):
            self.report('broken XML')
        with self.assertRaises(FileNotFoundError):
            validate('nonexistent-required-report.xml')

    def test_release_revision_requires_a_full_commit_sha(self):
        for ref in ('main', 'refs/heads/main', 'latest', 'a'*39, 'A'*40, None):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                render(ref)

    def test_only_two_app_services_and_secret_references(self):
        docs = render('a'*40)
        self.assertEqual([doc['name'] for doc in docs], ['syncarch-api', 'syncarch-web'])
        for doc in docs:
            self.assertEqual(doc['app'], 'dockerfile')
            self.assertEqual(doc['context']['git']['ref'], 'refs/heads/main')
            self.assertEqual(doc['context']['path'], '/')
            self.assertNotIn('image', doc['options'])
            self.assertEqual(doc['resources']['replicas'], 1)
            public_revision = doc['options']['env'][-1]
            self.assertEqual(public_revision, {'name': 'RELEASE_SHA', 'value': 'a'*40})
        self.assertTrue(all(set(env) == {'name', 'secret'} for env in docs[0]['options']['env'][:-1]))
        self.assertNotIn('mariadb', json.dumps(docs))

    def test_non_main_events_cannot_deploy(self):
        environment = {'CLOUDTYPE_TOKEN': 'test-only', 'DEPLOY_URL': 'https://example.com',
                       'SMOKE_LOGIN_ID': 'test-only', 'SMOKE_PASSWORD': 'test-only',
                       'GITHUB_REF': 'refs/heads/develop', 'GITHUB_EVENT_NAME': 'push'}
        with patch.dict('os.environ', environment, clear=True), patch('subprocess.check_output') as remote:
            with self.assertRaisesRegex(ValueError, 'main pushes'):
                preflight()
            remote.assert_not_called()

    def test_deploy_records_configuration_in_a_fresh_checkout(self):
        previous = Path.cwd()
        docs = [{'name': 'syncarch-api', 'context': {'git': {'ref': 'a'*40}}}]
        with tempfile.TemporaryDirectory() as folder:
            try:
                os.chdir(folder)
                with patch('deploy.render', return_value=docs), patch('deploy.build_opener') as opener, \
                     patch.dict('os.environ', {'CLOUDTYPE_TOKEN': 'test-only'}):
                    response = opener.return_value.open.return_value.__enter__.return_value
                    response.status = 204
                    response.read.return_value = b''
                    deploy('a'*40)
                    self.assertEqual(json.loads(Path('.local/cloudtype-release.json').read_text()), docs)
                    request = opener.return_value.open.call_args.args[0]
                    self.assertEqual(json.loads(request.data), {'request': docs, 'stages': ['main']})
                    self.assertEqual(request.full_url, 'https://app.cloudtype.io/api/project/gad03302/syncarch/deploy')
            finally:
                os.chdir(previous)

    def test_superseded_main_cannot_deploy(self):
        environment = {'CLOUDTYPE_TOKEN': 'test-only', 'DEPLOY_URL': 'https://example.com',
                       'SMOKE_LOGIN_ID': 'test-only', 'SMOKE_PASSWORD': 'test-only',
                       'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'push', 'GITHUB_SHA': 'a'*40}
        with patch.dict('os.environ', environment, clear=True), patch('subprocess.check_output', return_value='b'*40 + '\trefs/heads/main'):
            with self.assertRaisesRegex(ValueError, 'Superseded release'):
                preflight()


if __name__ == '__main__':
    unittest.main()
