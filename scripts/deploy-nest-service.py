"""Render: implanta Auth ou Pedidos por digest e valida o ambiente publicado.

Variáveis: SERVICE (auth|orders), RENDER_API_KEY, RENDER_SERVICE_ID, IMAGE
(docker.io/<conta>/<servico>-service@sha256:...), APP_URL, APP_ENV (dev|homol),
EXPECTED_VERSION e EXPECTED_COMMIT.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.render.com/v1'
FAILED = {'build_failed', 'update_failed', 'pre_deploy_failed', 'canceled', 'deactivated'}
ANY_ID = '00000000-0000-4000-8000-000000000000'

# Rotas de negócio verificadas sem credenciais: (método, caminho, corpo, status).
SERVICES = {
    'auth': {
        'version': '/api/v1/auth/version',
        # Login sem corpo válido falha na validação antes de acessar o banco.
        'business': ('POST', '/api/v1/auth/login', {}, 400),
    },
    'orders': {
        'version': '/api/v1/orders/version',
        'business': ('GET', f'/api/v1/orders/{ANY_ID}', None, 401),
    },
}


def request(url, *, token=None, payload=None, method=None):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, b''  # Nunca imprimir resposta de APIs ou credenciais.


def api(path, token, payload=None):
    status, body = request(API + path, token=token, payload=payload)
    if status not in (200, 201, 202):
        raise RuntimeError(f'API Render respondeu HTTP {status}')
    return json.loads(body)


def service_config(service):
    if service not in SERVICES:
        raise ValueError('SERVICE deve ser auth ou orders')
    return SERVICES[service]


def deploy(service, render_id, image, token, timeout=900):
    service_config(service)
    if not re.fullmatch(r'srv-[a-z0-9]+', render_id):
        raise ValueError('ID de serviço Render inválido')
    pattern = rf'docker\.io/[a-z0-9]+(?:[._-][a-z0-9]+)*/{service}-service@sha256:[0-9a-f]{{64}}'
    if not re.fullmatch(pattern, image):
        raise ValueError('A imagem deve usar Docker Hub, o repositório do serviço e digest sha256')
    path = f'/services/{render_id}/deploys'
    deploy_id = api(path, token, {'imageUrl': image})['id']
    if not re.fullmatch(r'dep-[a-z0-9]+', deploy_id):
        raise RuntimeError('ID de deploy Render inválido')
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = api(f'{path}/{deploy_id}', token)['status']
        print(f'Deploy {deploy_id}: {state}', flush=True)
        if state == 'live':
            return deploy_id
        if state in FAILED:
            raise RuntimeError(f'Deploy terminou em {state}')
        time.sleep(10)
    raise TimeoutError('Timeout aguardando deploy live')


def validate_origin(base):
    parsed = urllib.parse.urlsplit(base)
    if (
        parsed.scheme != 'https'
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ('', '/')
    ):
        raise ValueError('APP_URL deve ser uma origem HTTPS sem credenciais')
    return base.rstrip('/')


def wait_health(base, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            status, body = request(base + '/health')
            if status == 200 and json.loads(body).get('status') == 'ok':
                return
        except (OSError, ValueError):
            pass
        time.sleep(5)
    raise TimeoutError('Health público não ficou UP')


def verify(service, base, environment, version, commit, timeout=180):
    config = service_config(service)
    base = validate_origin(base)
    if environment not in ('dev', 'homol'):
        raise ValueError('APP_ENV deve ser dev ou homol')
    wait_health(base, timeout)

    swagger = 200 if environment == 'dev' else 404
    for path, expected in (('/metrics', 401), ('/docs', swagger), ('/docs-json', swagger)):
        actual, body = request(base + path)
        if actual != expected:
            raise RuntimeError(f'Validação {path}: esperado {expected}, recebido {actual}')
        if actual == 200 and path == '/docs' and b'swagger-ui' not in body:
            raise RuntimeError('Interface Swagger ausente')
        if actual == 200 and path == '/docs-json' and 'paths' not in json.loads(body):
            raise RuntimeError('Documento Swagger inválido')

    method, path, payload, expected = config['business']
    actual, _ = request(base + path, payload=payload, method=method)
    if actual != expected:
        raise RuntimeError(f'Validação {method} {path}: esperado {expected}, recebido {actual}')

    actual, body = request(base + config['version'])
    identity = {
        'service': f'{service}-service',
        'version': version,
        'commit': commit,
        'environment': environment,
    }
    if actual != 200 or json.loads(body) != identity:
        raise RuntimeError('Identidade implantada não corresponde à release aprovada')
    print(f'{service}: health, versão, métricas, rota de negócio e Swagger validados.')


def main():
    keys = (
        'SERVICE', 'RENDER_API_KEY', 'RENDER_SERVICE_ID', 'IMAGE', 'APP_URL',
        'APP_ENV', 'EXPECTED_VERSION', 'EXPECTED_COMMIT',
    )
    cfg = {key: os.environ.get(key, '') for key in keys}
    missing = [key for key, value in cfg.items() if not value]
    if missing:
        raise ValueError('Configuração ausente: ' + ', '.join(missing))
    deploy(cfg['SERVICE'], cfg['RENDER_SERVICE_ID'], cfg['IMAGE'], cfg['RENDER_API_KEY'])
    verify(cfg['SERVICE'], cfg['APP_URL'], cfg['APP_ENV'], cfg['EXPECTED_VERSION'], cfg['EXPECTED_COMMIT'])


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError) as exc:
        # Erros de transporte podem conter URL ou token; não imprimir a exceção crua.
        if isinstance(exc, (RuntimeError, ValueError, TimeoutError)):
            print(str(exc), file=sys.stderr)
        else:
            print('Falha no deploy/validação; consulte o painel Render.', file=sys.stderr)
        sys.exit(1)
