import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('health check', () => {
  it('retorna o estado do serviço', async () => {
    const service = new HealthService();
    const controller = new HealthController(service);

    await expect(controller.check()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'products-service',
      }),
    );
  });
});
