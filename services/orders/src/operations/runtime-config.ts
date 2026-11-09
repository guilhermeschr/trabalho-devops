type Environment = Record<string, string | undefined>;

const PUBLIC_SECRETS = new Set([
  'change-me',
  'change-me-in-development',
  'change-me-internal-development',
  'orders',
  'postgres',
]);

const REQUIRED_CLOUD_KEYS = [
  'JWT_SECRET',
  'INTERNAL_SERVICE_TOKEN',
  'METRICS_TOKEN',
  'ORDERS_DB_HOST',
  'ORDERS_DB_NAME',
  'ORDERS_DB_USER',
  'ORDERS_DB_PASSWORD',
  'PRODUCTS_SERVICE_URL',
  'INVENTORY_SERVICE_URL',
];

const DEPENDENCY_URL_KEYS = ['PRODUCTS_SERVICE_URL', 'INVENTORY_SERVICE_URL'];

export function resolvePort(env: Environment): number {
  const raw = env.PORT ?? env.ORDERS_PORT ?? '3000';
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

/** Na cloud, Produtos e Estoque são acessados por origem HTTPS sem credenciais. */
function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ['', '/'].includes(url.pathname)
    );
  } catch {
    return false;
  }
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
  for (const key of DEPENDENCY_URL_KEYS) {
    if (!isHttpsOrigin(env[key]!.trim())) {
      throw new Error(`${key} deve ser uma origem HTTPS sem credenciais`);
    }
  }
  const timeout = env.ORDERS_HTTP_TIMEOUT_MS;
  if (
    timeout !== undefined &&
    (!/^\d+$/u.test(timeout) || Number(timeout) < 1 || Number(timeout) > 60000)
  ) {
    throw new Error('ORDERS_HTTP_TIMEOUT_MS deve ser inteiro entre 1 e 60000');
  }
  if (
    env.METRICS_TOKEN === env.JWT_SECRET ||
    env.METRICS_TOKEN === env.INTERNAL_SERVICE_TOKEN
  ) {
    throw new Error('Token de métricas deve ser exclusivo');
  }
}
