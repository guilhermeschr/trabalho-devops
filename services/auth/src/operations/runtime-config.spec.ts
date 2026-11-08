import { databaseTls, resolvePort, validateCloudConfig } from './runtime-config';

function cloudConfig(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    APP_ENV: 'homol',
    NODE_ENV: 'production',
    SWAGGER_ENABLED: 'false',
    JWT_SECRET: 'test-jwt-secret',
    METRICS_TOKEN: 'test-metrics-token',
    AUTH_DB_HOST: 'db.example',
    AUTH_DB_NAME: 'auth_homol',
    AUTH_DB_USER: 'auth_homol',
    AUTH_DB_PASSWORD: 'test-database-secret',
    ...overrides,
  };
}

describe('configuração cloud de Auth', () => {
  it('prioriza PORT e mantém fallback local', () => {
    expect(resolvePort({ PORT: '10000', AUTH_PORT: '3001' })).toBe(10000);
    expect(resolvePort({ AUTH_PORT: '3001' })).toBe(3001);
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
    expect(() => validateCloudConfig({ APP_ENV: 'other' })).toThrow(
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
    ['JWT_SECRET', ''],
    ['JWT_SECRET', 'change-me-in-development'],
    ['METRICS_TOKEN', 'change-me'],
    ['METRICS_TOKEN', '   '],
    ['AUTH_DB_HOST', ''],
    ['AUTH_DB_PASSWORD', 'auth'],
  ])('bloqueia valor ausente ou fictício em %s=%p', (key, value) => {
    expect(() => validateCloudConfig(cloudConfig({ [key]: value }))).toThrow(
      `Configuração cloud ausente ou fictícia: ${key}`,
    );
  });

  it('aceita usuário de banco igual ao nome do serviço', () => {
    expect(() =>
      validateCloudConfig(cloudConfig({ AUTH_DB_USER: 'auth' })),
    ).not.toThrow();
  });

  it('exige token de métricas diferente do segredo JWT', () => {
    expect(() =>
      validateCloudConfig(cloudConfig({ METRICS_TOKEN: 'test-jwt-secret' })),
    ).toThrow('Token de métricas deve ser exclusivo');
  });

  it('habilita TLS com validação de certificado', () => {
    expect(databaseTls('true')).toEqual({ rejectUnauthorized: true });
    expect(databaseTls('false')).toBe(false);
    expect(databaseTls(undefined)).toBe(false);
  });
});
