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
});
