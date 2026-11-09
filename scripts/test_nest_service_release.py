import importlib.util
import json
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('nest_release', Path(__file__).with_name('nest-service-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
SHA = 'a' * 40
DIGEST = 'sha256:' + 'b' * 64


def http_error(code):
    return urllib.error.HTTPError('https://registry.example', code, 'erro', {}, None)


def response(payload, headers=None):
    mock = MagicMock()
    mock.__enter__.return_value = mock
    mock.read.return_value = json.dumps(payload).encode()
    mock.headers = headers or {}
    return mock


class ReleaseMetadataTest(unittest.TestCase):
    def test_dev_and_homol_per_service(self):
        dev = release.metadata('auth', 'd2gtrabalhos', '0.2.0', 'develop', SHA, '17')
        self.assertEqual(dev['version'], '0.2.0-dev.17')
        self.assertEqual(dev['tag'], 'auth-v0.2.0-dev.17')
        self.assertEqual(dev['image'], 'docker.io/d2gtrabalhos/auth-service')
        homol = release.metadata('orders', 'conta-propria', '0.2.0', 'main', SHA, '17')
        self.assertEqual(homol['version'], '0.2.0')
        self.assertEqual(homol['tag'], 'orders-v0.2.0')
        self.assertEqual(homol['image'], 'docker.io/conta-propria/orders-service')

    def test_untrusted_inputs(self):
        cases = [
            ('products', 'conta', '1.0.0', 'main', SHA, '1'),
            ('auth', 'Conta', '1.0.0', 'main', SHA, '1'),
            ('auth', '', '1.0.0', 'main', SHA, '1'),
            ('auth', 'conta', 'v1.0.0', 'main', SHA, '1'),
            ('auth', 'conta', '01.0.0', 'main', SHA, '1'),
            ('auth', 'conta', '1.0.0', 'feature/x', SHA, '1'),
            ('auth', 'conta', '1.0.0', 'main', 'bad', '1'),
            ('auth', 'conta', '1.0.0', 'develop', SHA, 'oops'),
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                release.metadata(*case)

    def test_reuse_requires_original_commit(self):
        self.assertEqual(release.existing_image(SHA, {'revision': SHA, 'digest': DIGEST}), DIGEST)
        with self.assertRaises(ValueError):
            release.existing_image(SHA, {'revision': 'c' * 40, 'digest': DIGEST})
        with self.assertRaises(ValueError):
            release.existing_image(SHA, {'revision': SHA, 'digest': 'sha256:bad'})


class RegistryLookupTest(unittest.TestCase):
    @patch.object(release.urllib.request, 'urlopen')
    def test_missing_tag_allows_publication(self, urlopen):
        urlopen.side_effect = [response({'token': 't'}), http_error(404)]
        self.assertEqual('', release.lookup('conta/auth-service', '0.2.0', SHA))

    @patch.object(release.urllib.request, 'urlopen')
    def test_registry_failure_stops_publication(self, urlopen):
        urlopen.side_effect = [response({'token': 't'}), http_error(500)]
        with self.assertRaises(RuntimeError):
            release.lookup('conta/auth-service', '0.2.0', SHA)

    @patch.object(release.urllib.request, 'urlopen')
    def test_token_failure_stops_publication(self, urlopen):
        urlopen.side_effect = http_error(503)
        with self.assertRaises(RuntimeError):
            release.lookup('conta/auth-service', '0.2.0', SHA)

    @patch.object(release.urllib.request, 'urlopen')
    def test_existing_tag_reuses_digest_of_same_commit(self, urlopen):
        manifest = response({'config': {'digest': 'sha256:' + 'c' * 64}}, {'Docker-Content-Digest': DIGEST})
        config = response({'config': {'Labels': {'org.opencontainers.image.revision': SHA}}})
        urlopen.side_effect = [response({'token': 't'}), manifest, config]
        self.assertEqual(DIGEST, release.lookup('conta/auth-service', '0.2.0', SHA))


class MainTest(unittest.TestCase):
    def test_writes_github_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'out'
            env = {
                'SERVICE': 'auth', 'DOCKERHUB_USERNAME': 'conta', 'BRANCH': 'develop',
                'SHA': SHA, 'RUN_NUMBER': '5', 'GITHUB_OUTPUT': str(output),
            }
            root = Path(__file__).resolve().parents[1]
            with patch.dict(os.environ, env, clear=True), patch.object(release, 'lookup', return_value='') as lookup:
                cwd = os.getcwd()
                os.chdir(root)
                try:
                    release.main()
                finally:
                    os.chdir(cwd)
            version = json.loads((root / 'services/auth/package.json').read_text())['version']
            lookup.assert_called_once_with('conta/auth-service', f'{version}-dev.5', SHA)
            text = output.read_text()
            self.assertIn(f'tag=auth-v{version}-dev.5\n', text)
            self.assertIn('image=docker.io/conta/auth-service\n', text)
            self.assertIn('digest=\n', text)


if __name__ == '__main__':
    unittest.main()
