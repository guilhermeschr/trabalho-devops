"""Render: implanta imagens por digest e valida o deploy especifico e o gateway."""
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


def request(url, *, token=None, payload=None):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers)
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


def deploy(service, image, token, timeout=900):
    if not re.fullmatch(r'srv-[a-z0-9]+', service):
        raise ValueError('ID de servico Render invalido')
    if not re.fullmatch(r'ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}', image):
        raise ValueError('A imagem deve usar GHCR e digest sha256')
    path = '/services/' + service + '/deploys'
    started = api(path, token, {'imageUrl': image})
    deploy_id = started['id']
    if not re.fullmatch(r'dep-[a-z0-9]+', deploy_id):
        raise RuntimeError('ID de deploy Render invalido')
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = api(path + '/' + deploy_id, token)['status']
        print(f'Deploy {deploy_id}: {state}', flush=True)
        if state == 'live':
            return deploy_id
        if state in FAILED:
            raise RuntimeError(f'Deploy terminou em {state}')
        time.sleep(10)
    raise TimeoutError('Timeout aguardando deploy live')


def verify(base, environment, timeout=180):
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('APP_URL deve ser uma origem HTTPS sem credenciais')
    if environment not in ('dev', 'homol'):
        raise ValueError('APP_ENV deve ser dev ou homol')
    base = base.rstrip('/')
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            status, body = request(base + '/actuator/health/readiness')
            if status == 200 and json.loads(body).get('status') == 'UP':
                break
        except (OSError, ValueError):
            pass
        time.sleep(5)
    else:
        raise TimeoutError('Readiness publica nao ficou UP')
    expected = {
        '/internal/v1/inventory/debit': 404,
        '/internal;tracking=test/v1/inventory/debit': 404,
        '/api/v1/inventory': 401,
        '/actuator/prometheus': 401,
        '/docs': 200 if environment == 'dev' else 404,
        '/docs-json': 200 if environment == 'dev' else 404,
    }
    for path, status in expected.items():
        actual, _ = request(base + path)
        if actual != status:
            raise RuntimeError(f'Validacao {path}: esperado {status}, recebido {actual}')
    print('Gateway: readiness, JWT, metricas, isolamento e Swagger validados.')


def main():
    keys = ('RENDER_API_KEY', 'RENDER_SERVICE_ID', 'RENDER_GATEWAY_SERVICE_ID',
            'IMAGE', 'GATEWAY_IMAGE', 'APP_URL', 'APP_ENV')
    cfg = {key: os.environ.get(key, '') for key in keys}
    missing = [key for key, value in cfg.items() if not value]
    if missing:
        raise ValueError('Configuracao ausente: ' + ', '.join(missing))
    deploy(cfg['RENDER_SERVICE_ID'], cfg['IMAGE'], cfg['RENDER_API_KEY'])
    deploy(cfg['RENDER_GATEWAY_SERVICE_ID'], cfg['GATEWAY_IMAGE'], cfg['RENDER_API_KEY'])
    verify(cfg['APP_URL'], cfg['APP_ENV'])


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError) as exc:
        # Erros de transporte podem conter URL. Nao imprimir excecao crua.
        if isinstance(exc, (RuntimeError, ValueError)) and not isinstance(exc, OSError):
            print(str(exc), file=sys.stderr)
        else:
            print('Falha no deploy/validacao; consulte o painel Render.', file=sys.stderr)
        sys.exit(1)
