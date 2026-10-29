import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy_inventory', Path(__file__).with_name('deploy-inventory.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
IMAGE = 'ghcr.io/example/inventory@sha256:' + 'a' * 64


class DeploymentTest(unittest.TestCase):
    @patch.object(deploy.time, 'sleep')
    @patch.object(deploy, 'api')
    def test_polls_exact_deploy_until_live(self, api, sleep):
        api.side_effect = [{'id': 'dep-123'}, {'status': 'update_in_progress'}, {'status': 'live'}]
        self.assertEqual('dep-123', deploy.deploy('srv-123', IMAGE, 'test-token'))
        self.assertEqual({'imageUrl': IMAGE}, api.call_args_list[0].args[2])
        self.assertEqual('/services/srv-123/deploys/dep-123', api.call_args_list[-1].args[0])
        sleep.assert_called_once()

    @patch.object(deploy, 'api')
    def test_failed_deploy_is_not_success(self, api):
        api.side_effect = [{'id': 'dep-123'}, {'status': 'update_failed'}]
        with self.assertRaises(RuntimeError):
            deploy.deploy('srv-123', IMAGE, 'test-token')

    @patch.object(deploy, 'api')
    def test_tag_cannot_replace_digest(self, api):
        with self.assertRaises(ValueError):
            deploy.deploy('srv-123', 'ghcr.io/example/inventory:latest', 'test-token')
        api.assert_not_called()

    @patch.object(deploy.time, 'monotonic', side_effect=[0, 901])
    @patch.object(deploy, 'api', return_value={'id': 'dep-123'})
    def test_timeout_is_not_success(self, api, clock):
        with self.assertRaises(TimeoutError):
            deploy.deploy('srv-123', IMAGE, 'test-token')

    def responses(self, environment, internal_status=403, swagger_wrong=False):
        def respond(url, **kwargs):
            if url.endswith('/actuator/health/readiness'):
                return 200, b'{"status":"UP"}'
            if '/internal' in url:
                self.assertEqual({}, kwargs.get('payload'))
                return internal_status, b''
            if url.endswith('/docs') or url.endswith('/docs-json'):
                status = 200 if environment == 'dev' else 404
                return (200 if swagger_wrong else status), b''
            return 401, b''
        return respond

    def test_dev_and_homol_public_contracts(self):
        for environment in ('dev', 'homol'):
            with patch.object(deploy, 'request', side_effect=self.responses(environment)):
                deploy.verify('https://inventory.example', environment)

    def test_internal_route_requires_token_and_must_be_reachable(self):
        for status in (200, 404, 500):
            with self.subTest(status=status), patch.object(
                deploy, 'request', side_effect=self.responses('dev', internal_status=status)
            ):
                with self.assertRaises(RuntimeError):
                    deploy.verify('https://inventory.example', 'dev')

    @patch.dict('os.environ', {
        'RENDER_API_KEY': 'test-token', 'RENDER_SERVICE_ID': 'srv-123',
        'IMAGE': IMAGE, 'APP_URL': 'https://inventory.example', 'APP_ENV': 'dev',
    }, clear=True)
    @patch.object(deploy, 'verify')
    @patch.object(deploy, 'deploy')
    def test_deploys_only_inventory_without_gateway_configuration(self, start, verify):
        deploy.main()
        start.assert_called_once_with('srv-123', IMAGE, 'test-token')
        verify.assert_called_once_with('https://inventory.example', 'dev')

    def test_homol_swagger_exposure_fails(self):
        with patch.object(deploy, 'request', side_effect=self.responses('homol', swagger_wrong=True)):
            with self.assertRaises(RuntimeError):
                deploy.verify('https://inventory.example', 'homol')

    @patch.object(deploy, 'request')
    def test_rejects_invalid_public_url(self, request):
        with self.assertRaises(ValueError):
            deploy.verify('http://inventory.example', 'dev')
        request.assert_not_called()


if __name__ == '__main__':
    unittest.main()
