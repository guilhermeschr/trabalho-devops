type Environment = Record<string, string | undefined>;

const PUBLIC_SECRETS = new Set([
  'change-me',
  'change-me-in-development',
  'change-me-internal-development',
  'auth',
  'postgres',
]);

const REQUIRED_CLOUD_KEYS = [
  'JWT_SECRET',
  'METRICS_TOKEN',
  'AUTH_DB_HOST',
  'AUTH_DB_NAME',
  'AUTH_DB_USER',
  'AUTH_DB_PASSWORD',
];

export function resolvePort(env: Environment): number {
  const raw = env.PORT ?? env.AUTH_PORT ?? '3000';
  if (!/^\d+$/u.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new Error('Porta inválida');
  }
  return Number(raw);
}

export function databaseTls(
  enabled: string | undefined,
): false | { rejectUnauthorized: true } {
  return enabled === 'true' ? { rejectUnauthorized: true } : false;
}

function isSecretKey(key: string): boolean {
  return /(PASSWORD|TOKEN|SECRET)$/u.test(key);
}

export function validateCloudConfig(env: Environment): void {
  if (!env.APP_ENV || env.APP_ENV === 'local') return;
  if (!['dev', 'homol'].includes(env.APP_ENV)) {
    throw new Error('APP_ENV deve ser local, dev ou homol');
  }
  if (
    env.APP_ENV === 'homol' &&
    (env.SWAGGER_ENABLED !== 'false' || env.NODE_ENV !== 'production')
  ) {
    throw new Error('HOMOL exige Swagger desligado e NODE_ENV=production');
  }
  for (const key of REQUIRED_CLOUD_KEYS) {
    const value = env[key]?.trim();
    if (!value || (isSecretKey(key) && PUBLIC_SECRETS.has(value))) {
      throw new Error(`Configuração cloud ausente ou fictícia: ${key}`);
    }
  }
  if (env.METRICS_TOKEN === env.JWT_SECRET) {
    throw new Error('Token de métricas deve ser exclusivo');
  }
}
