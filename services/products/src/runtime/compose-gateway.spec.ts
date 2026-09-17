import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('exposição do gateway', () => {
  it('publica somente o Nginx no host sem isolar a porta publicada', () => {
    const compose = readFileSync(
      join(__dirname, '../../../../infra/docker/docker-compose.yml'),
      'utf8',
    );

    expect(compose).toContain('${PRODUCTS_PUBLIC_PORT:-8080}:80');
    expect(compose).not.toMatch(/^\s+internal:\s+true\s*$/mu);
  });

  it('carrega o .env da raiz nos comandos de infraestrutura', () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    for (const scriptName of ['infra:config', 'infra:up', 'infra:down']) {
      expect(packageJson.scripts[scriptName]).toContain('--env-file .env');
    }
  });

  it('recria os serviços para aplicar alterações do .env', () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['infra:up']).toContain('--force-recreate');
  });
});
