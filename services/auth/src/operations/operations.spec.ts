import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BuildInfoService } from './build-info.service';
import { OperationsModule } from './operations.module';

const BUILD = { version: '0.2.0', commit: 'a'.repeat(40) };

async function createApp(
  config: Record<string, string>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [OperationsModule],
  })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(config))
    .overrideProvider(BuildInfoService)
    .useValue({ get: () => ({ ...BUILD }) })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('operações de Auth', () => {
  it('retorna a versão pública sem aceitar override de identidade em runtime', async () => {
    const app = await createApp({ APP_ENV: 'homol', APP_VERSION: 'fake' });
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/version')
        .expect(200);
      expect(response.body).toEqual({
        service: 'auth-service',
        ...BUILD,
        environment: 'homol',
      });
    } finally {
      await app.close();
    }
  });

  it('usa local como ambiente padrão', async () => {
    const app = await createApp({});
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/version')
        .expect(200);
      expect(response.body.environment).toBe('local');
    } finally {
      await app.close();
    }
  });

  it('nega métricas sem token configurado', async () => {
    const app = await createApp({ APP_ENV: 'dev' });
    try {
      await request(app.getHttpServer())
        .get('/metrics')
        .set('Authorization', 'Bearer ')
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it('protege métricas e limita a cardinalidade de rotas desconhecidas', async () => {
    const app = await createApp({
      APP_ENV: 'dev',
      METRICS_TOKEN: 'test-metrics-token',
    });
    try {
      const server = app.getHttpServer();
      await request(server).get('/metrics').expect(401);
      await request(server)
        .get('/metrics')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      await request(server).get('/private-user@example.com').expect(404);
      await request(server).get('/api/v1/auth/version').expect(200);
      const response = await request(server)
        .get('/metrics')
        .set('Authorization', 'Bearer test-metrics-token')
        .expect(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('route="/api/v1/auth/version"');
      expect(response.text).toContain('route="unmatched"');
      expect(response.text).not.toContain('private-user');
      expect(response.text).not.toContain('route="/metrics"');
      expect(response.text).toContain('service="auth-service"');
      expect(response.text).toContain('environment="dev"');
      expect(response.text).toContain(
        `auth_build_info{version="0.2.0",commit="${BUILD.commit}"`,
      );
    } finally {
      await app.close();
    }
  });
});
