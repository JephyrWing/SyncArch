"""Negative cases for release gates; independent of the product test environment."""
import json
from pathlib import Path
import tempfile
import unittest

from check_junit import validate
from deploy import render


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

    def test_deployment_rejects_mutable_tags(self):
        with self.assertRaises(ValueError):
            render({'frontend': 'ghcr.io/jephyrwing/syncarch-frontend:latest',
                    'backend': 'ghcr.io/jephyrwing/syncarch-backend:main'})

    def test_only_two_app_services_and_secret_references(self):
        images = {name: 'ghcr.io/jephyrwing/syncarch-' + name + '@sha256:' + 'a'*64
                  for name in ('frontend', 'backend')}
        docs = render(images)
        self.assertEqual([doc['name'] for doc in docs], ['backend', 'frontend'])
        backend = docs[0]
        self.assertEqual(backend['resources']['replicas'], 1)
        self.assertTrue(all(set(env) == {'name', 'secret'} for env in backend['options']['env']))
        self.assertNotIn('mariadb', json.dumps(docs))


if __name__ == '__main__':
    unittest.main()
