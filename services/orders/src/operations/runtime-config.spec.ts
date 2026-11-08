import { databaseTls, resolvePort, validateCloudConfig } from './runtime-config';

function cloudConfig(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_ENV: 'homol',
    NODE_ENV: 'production',
    SWAGGER_ENABLED: 'false',
    JWT_SECRET: 'test-jwt-secret',
    INTERNAL_SERVICE_TOKEN: 'test-internal-token',
    METRICS_TOKEN: 'test-metrics-token',
    ORDERS_DB_HOST: 'db.example',
    ORDERS_DB_NAME: 'orders_homol',
    ORDERS_DB_USER: 'orders_homol',
    ORDERS_DB_PASSWORD: 'test-database-secret',
    PRODUCTS_SERVICE_URL: 'https://products-homol.example',
    INVENTORY_SERVICE_URL: 'https://inventory-homol.example/',
    ...overrides,
  };
}

describe('configuração cloud de Pedidos', () => {
  it('prioriza PORT e mantém fallback local', () => {
    expect(resolvePort({ PORT: '10000', ORDERS_PORT: '3001' })).toBe(10000);
    expect(resolvePort({ ORDERS_PORT: '3001' })).toBe(3001);
    expect(resolvePort({})).toBe(3000);
  });

  it.each(['', '0', '-1', '65536', 'abc', '3.5'])(
    'rejeita porta inválida %p',
    (port) => {
      expect(() => resolvePort({ PORT: port })).toThrow('Porta inválida');
    },
  );

  it('não exige configuração cloud no ambiente local', () => {
    expect(() => validateCloudConfig({})).not.toThrow();
    expect(() => validateCloudConfig({ APP_ENV: 'local' })).not.toThrow();
  });

  it('rejeita ambiente desconhecido', () => {
    expect(() => validateCloudConfig({ APP_ENV: 'prod' })).toThrow(
      'APP_ENV deve ser local, dev ou homol',
    );
  });

  it('aceita configuração completa em DEV e HOMOL', () => {
    expect(() => validateCloudConfig(cloudConfig())).not.toThrow();
    expect(() =>
      validateCloudConfig(
        cloudConfig({
          APP_ENV: 'dev',
          NODE_ENV: 'development',
          SWAGGER_ENABLED: 'true',
          ORDERS_HTTP_TIMEOUT_MS: '5000',
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ['SWAGGER_ENABLED', 'true'],
    ['NODE_ENV', 'development'],
  ])('exige Swagger desligado em HOMOL (%s=%s)', (key, value) => {
    expect(() => validateCloudConfig(cloudConfig({ [key]: value }))).toThrow(
      'HOMOL exige Swagger desligado',
    );
  });

  it.each([
    ['JWT_SECRET', 'change-me-in-development'],
    ['INTERNAL_SERVICE_TOKEN', 'change-me-internal-development'],
    ['INTERNAL_SERVICE_TOKEN', ''],
    ['METRICS_TOKEN', 'change-me'],
    ['ORDERS_DB_PASSWORD', 'orders'],
    ['ORDERS_DB_HOST', '   '],
    ['PRODUCTS_SERVICE_URL', undefined],
    ['INVENTORY_SERVICE_URL', ''],
  ])('bloqueia valor ausente ou fictício em %s=%p', (key, value) => {
    expect(() => validateCloudConfig(cloudConfig({ [key]: value }))).toThrow(
      `Configuração cloud ausente ou fictícia: ${key}`,
    );
  });

  it.each([
    ['PRODUCTS_SERVICE_URL', 'http://products-service:3000'],
    ['PRODUCTS_SERVICE_URL', 'https://user:pass@products.example'],
    ['PRODUCTS_SERVICE_URL', 'https://products.example/internal'],
    ['INVENTORY_SERVICE_URL', 'https://inventory.example?x=1'],
    ['INVENTORY_SERVICE_URL', 'not-a-url'],
  ])('exige origem HTTPS em %s=%p', (key, value) => {
    expect(() => validateCloudConfig(cloudConfig({ [key]: value }))).toThrow(
      `${key} deve ser uma origem HTTPS sem credenciais`,
    );
  });

  it.each(['0', '-1', 'abc', '60001', '1.5'])(
    'rejeita timeout inválido %p',
    (timeout) => {
      expect(() =>
        validateCloudConfig(cloudConfig({ ORDERS_HTTP_TIMEOUT_MS: timeout })),
      ).toThrow('ORDERS_HTTP_TIMEOUT_MS');
    },
  );

  it.each(['test-jwt-secret', 'test-internal-token'])(
    'exige token de métricas exclusivo (%p)',
    (token) => {
      expect(() =>
        validateCloudConfig(cloudConfig({ METRICS_TOKEN: token })),
      ).toThrow('Token de métricas deve ser exclusivo');
    },
  );

  it('habilita TLS com validação de certificado', () => {
    expect(databaseTls('true')).toEqual({ rejectUnauthorized: true });
    expect(databaseTls('false')).toBe(false);
    expect(databaseTls(undefined)).toBe(false);
  });
});
