"""Identidade da release de Auth ou Pedidos.

Uso no CI: SERVICE=auth|orders DOCKERHUB_USERNAME=<conta> BRANCH SHA RUN_NUMBER
python3 scripts/nest-service-release.py

Consulta o Docker Hub sem credenciais privadas para reutilizar uma imagem já
publicada do mesmo commit e bloquear a mesma versão com outro commit.
"""
import json
import os
import re
import urllib.error
import urllib.request

SERVICES = ('auth', 'orders')
SEMVER = r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'


def repository(service, username):
    if service not in SERVICES:
        raise ValueError('Serviço deve ser auth ou orders')
    if not re.fullmatch(r'[a-z0-9]+(?:[._-][a-z0-9]+)*', username or ''):
        raise ValueError('Usuário Docker Hub inválido')
    return f'{username}/{service}-service'


def metadata(service, username, version, branch, sha, run):
    repo = repository(service, username)
    if not re.fullmatch(SEMVER, version):
        raise ValueError('Versão deve ser SemVer X.Y.Z')
    if branch not in ('main', 'develop'):
        raise ValueError('Releases são publicadas somente em main ou develop')
    if not re.fullmatch('[0-9a-f]{40}', sha) or not re.fullmatch('[1-9][0-9]*', run):
        raise ValueError('SHA ou número de execução inválidos')
    value = version if branch == 'main' else f'{version}-dev.{run}'
    return {
        'version': value,
        'tag': f'{service}-v{value}',
        'image': f'docker.io/{repo}',
        'commit': sha,
    }


def existing_image(sha, found):
    if found['revision'] != sha:
        raise ValueError('Release já existe com outro commit; incremente a versão')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', found['digest'] or ''):
        raise ValueError('Digest inválido')
    return found['digest']


def lookup(repo, version, sha):
    token_url = (
        'https://auth.docker.io/token?service=registry.docker.io'
        f'&scope=repository:{repo}:pull'
    )
    try:
        with urllib.request.urlopen(token_url, timeout=30) as response:
            token = json.load(response)['token']
    except urllib.error.HTTPError:
        raise RuntimeError('Falha ao autenticar no registry; publicação interrompida') from None
    root = f'https://registry-1.docker.io/v2/{repo}'
    accept = (
        'application/vnd.oci.image.manifest.v1+json, '
        'application/vnd.docker.distribution.manifest.v2+json'
    )

    def get(path):
        req = urllib.request.Request(
            root + path,
            headers={'Authorization': 'Bearer ' + token, 'Accept': accept},
        )
        return urllib.request.urlopen(req, timeout=30)

    try:
        response = get('/manifests/' + version)
    except urllib.error.HTTPError as error:
        # Repositório ainda inexistente também responde 401/404 sem credenciais.
        if error.code in (401, 404):
            return ''
        raise RuntimeError('Falha ao consultar registry; publicação interrompida') from None
    with response:
        digest = response.headers['Docker-Content-Digest']
        manifest = json.load(response)
    with get('/blobs/' + manifest['config']['digest']) as response:
        config = json.load(response)
    labels = config['config'].get('Labels') or {}
    return existing_image(
        sha,
        {'revision': labels.get('org.opencontainers.image.revision'), 'digest': digest},
    )


def main():
    service = os.environ['SERVICE']
    with open(f'services/{service}/package.json', encoding='utf-8') as stream:
        base = json.load(stream)['version']
    values = metadata(
        service,
        os.environ['DOCKERHUB_USERNAME'],
        base,
        os.environ['BRANCH'],
        os.environ['SHA'],
        os.environ['RUN_NUMBER'],
    )
    values['digest'] = lookup(values['image'].removeprefix('docker.io/'), values['version'], values['commit'])
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
        for key, value in values.items():
            stream.write(f'{key}={value}\n')


if __name__ == '__main__':
    main()
