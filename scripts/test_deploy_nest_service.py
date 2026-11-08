import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy_nest', Path(__file__).with_name('deploy-nest-service.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
SHA = 'a' * 40
IMAGE = 'docker.io/d2gtrabalhos/auth-service@sha256:' + 'a' * 64
ORDERS_IMAGE = 'docker.io/conta/orders-service@sha256:' + 'b' * 64


class RenderDeployTest(unittest.TestCase):
    @patch.object(deploy.time, 'sleep')
    @patch.object(deploy, 'api')
    def test_polls_exact_deploy_until_live(self, api, sleep):
        api.side_effect = [{'id': 'dep-123'}, {'status': 'update_in_progress'}, {'status': 'live'}]
        self.assertEqual('dep-123', deploy.deploy('auth', 'srv-123', IMAGE, 'test-token'))
        self.assertEqual({'imageUrl': IMAGE}, api.call_args_list[0].args[2])
        self.assertEqual('/services/srv-123/deploys/dep-123', api.call_args_list[-1].args[0])
        sleep.assert_called_once()

    @patch.object(deploy, 'api')
    def test_failed_deploy_is_not_success(self, api):
        api.side_effect = [{'id': 'dep-123'}, {'status': 'update_failed'}]
        with self.assertRaises(RuntimeError):
            deploy.deploy('auth', 'srv-123', IMAGE, 'test-token')

    @patch.object(deploy, 'api')
    def test_rejects_invalid_deploy_id(self, api):
        api.side_effect = [{'id': '../x'}]
        with self.assertRaises(RuntimeError):
            deploy.deploy('auth', 'srv-123', IMAGE, 'test-token')

    @patch.object(deploy, 'api')
    def test_rejects_tag_other_service_or_invalid_ids(self, api):
        cases = [
            ('auth', 'srv-123', 'docker.io/d2gtrabalhos/auth-service:latest'),
            ('auth', 'srv-123', ORDERS_IMAGE),
            ('orders', 'srv-123', IMAGE),
            ('auth', 'invalid', IMAGE),
            ('products', 'srv-123', IMAGE),
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                deploy.deploy(*case, 'test-token')
        api.assert_not_called()

    @patch.object(deploy.time, 'monotonic', side_effect=[0, 901])
    @patch.object(deploy, 'api', return_value={'id': 'dep-123'})
    def test_timeout_is_not_success(self, api, clock):
        with self.assertRaises(TimeoutError):
            deploy.deploy('auth', 'srv-123', IMAGE, 'test-token')

    @patch.object(deploy, 'request', return_value=(500, b''))
    def test_api_error_is_reported_without_body(self, request):
        with self.assertRaisesRegex(RuntimeError, 'HTTP 500'):
            deploy.api('/services', 'test-token')


class PublicVerificationTest(unittest.TestCase):
    def responses(self, service, environment, business=None, swagger_wrong=False, identity=None):
        expected_business = deploy.SERVICES[service]['business'][3]

        def respond(url, **kwargs):
            if url.endswith('/health'):
                return 200, b'{"status":"ok"}'
            if url.endswith('/version'):
                body = identity or {'service': f'{service}-service', 'version': '0.2.0', 'commit': SHA, 'environment': environment}
                return 200, json.dumps(body).encode()
            if url.endswith('/metrics'):
                return 401, b''
            if url.endswith('/docs') or url.endswith('/docs-json'):
                status = 200 if environment == 'dev' or swagger_wrong else 404
                return status, (b'swagger-ui' if url.endswith('/docs') else b'{"paths":{}}')
            return (business or expected_business), b''

        return respond

    def test_dev_and_homol_contracts_for_both_services(self):
        for service in ('auth', 'orders'):
            for environment in ('dev', 'homol'):
                with self.subTest(service=service, environment=environment), patch.object(
                    deploy, 'request', side_effect=self.responses(service, environment)
                ):
                    deploy.verify(service, 'https://svc.example', environment, '0.2.0', SHA)

    def test_auth_login_probe_sends_post_without_credentials(self):
        with patch.object(deploy, 'request', side_effect=self.responses('auth', 'dev')) as request:
            deploy.verify('auth', 'https://svc.example', 'dev', '0.2.0', SHA)
        call = next(c for c in request.call_args_list if c.args[0].endswith('/login'))
        self.assertEqual({'payload': {}, 'method': 'POST'}, call.kwargs)

    def test_unprotected_business_route_fails(self):
        with patch.object(deploy, 'request', side_effect=self.responses('orders', 'dev', business=200)):
            with self.assertRaises(RuntimeError):
                deploy.verify('orders', 'https://svc.example', 'dev', '0.2.0', SHA)

    def test_homol_swagger_exposure_fails(self):
        with patch.object(deploy, 'request', side_effect=self.responses('auth', 'homol', swagger_wrong=True)):
            with self.assertRaises(RuntimeError):
                deploy.verify('auth', 'https://svc.example', 'homol', '0.2.0', SHA)

    def test_wrong_identity_fails(self):
        wrong = {'service': 'auth-service', 'version': '0.1.0', 'commit': SHA, 'environment': 'dev'}
        with patch.object(deploy, 'request', side_effect=self.responses('auth', 'dev', identity=wrong)):
            with self.assertRaisesRegex(RuntimeError, 'Identidade'):
                deploy.verify('auth', 'https://svc.example', 'dev', '0.2.0', SHA)

    @patch.object(deploy.time, 'sleep')
    @patch.object(deploy.time, 'monotonic', side_effect=[0, 0, 181])
    @patch.object(deploy, 'request', return_value=(503, b''))
    def test_health_timeout(self, request, clock, sleep):
        with self.assertRaises(TimeoutError):
            deploy.verify('auth', 'https://svc.example', 'dev', '0.2.0', SHA)

    @patch.object(deploy, 'request')
    def test_rejects_invalid_url_and_environment(self, request):
        for base, environment in [
            ('http://svc.example', 'dev'),
            ('https://user:pass@svc.example', 'dev'),
            ('https://svc.example/path', 'dev'),
            ('https://svc.example', 'prod'),
        ]:
            with self.subTest(base=base, environment=environment), self.assertRaises(ValueError):
                deploy.verify('auth', base, environment, '0.2.0', SHA)
        request.assert_not_called()


class MainTest(unittest.TestCase):
    ENV = {
        'SERVICE': 'auth', 'RENDER_API_KEY': 'test-token', 'RENDER_SERVICE_ID': 'srv-123',
        'EXPECTED_VERSION': '0.2.0', 'EXPECTED_COMMIT': SHA, 'IMAGE': IMAGE,
        'APP_URL': 'https://auth.example', 'APP_ENV': 'dev',
    }

    @patch.dict(os.environ, ENV, clear=True)
    @patch.object(deploy, 'verify')
    @patch.object(deploy, 'deploy')
    def test_deploys_and_verifies_service(self, start, verify):
        deploy.main()
        start.assert_called_once_with('auth', 'srv-123', IMAGE, 'test-token')
        verify.assert_called_once_with('auth', 'https://auth.example', 'dev', '0.2.0', SHA)

    @patch.dict(os.environ, {'SERVICE': 'auth'}, clear=True)
    def test_missing_configuration(self):
        with self.assertRaisesRegex(ValueError, 'RENDER_API_KEY'):
            deploy.main()


if __name__ == '__main__':
    unittest.main()
