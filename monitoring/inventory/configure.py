"""Gera somente targets publicos. Tokens sao fornecidos em arquivos locais."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parent
for environment in ('dev', 'homol'):
    url = os.environ.get('INVENTORY_' + environment.upper() + '_URL', '')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise SystemExit('Configure INVENTORY_' + environment.upper() + '_URL como origem HTTPS')
    target = [{'targets': [parsed.netloc], 'labels': {'environment': environment, 'application': 'inventory-service'}}]
    directory = root / 'targets'
    directory.mkdir(exist_ok=True)
    (directory / (environment + '.json')).write_text(json.dumps(target, indent=2) + '\n')
print('Targets gerados. Forneca .secrets/{dev,homol}_metrics_token antes de iniciar.')
