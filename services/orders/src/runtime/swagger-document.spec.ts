import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from '../common/swagger/swagger.setup';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { CompleteOrderUseCase } from '../modules/orders/application/use-cases/complete-order.use-case';
import { CreateOrderUseCase } from '../modules/orders/application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../modules/orders/application/use-cases/get-order.use-case';
import { JwtAuthGuard } from '../modules/orders/infrastructure/auth/jwt-auth.guard';
import { OrdersController } from '../modules/orders/presentation/http/orders.controller';
import { BuildInfoService } from '../operations/build-info.service';
import { MetricsService } from '../operations/metrics.service';
import { OperationsController } from '../operations/operations.controller';

describe('contrato OpenAPI do serviço de Pedidos', () => {
  it('documenta rotas protegidas, operacionais, respostas e schemas', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OperationsController, OrdersController, HealthController],
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: CreateOrderUseCase, useValue: {} },
        { provide: GetOrderUseCase, useValue: {} },
        { provide: CompleteOrderUseCase, useValue: {} },
        { provide: HealthService, useValue: {} },
        { provide: BuildInfoService, useValue: {} },
        { provide: MetricsService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    const document = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig(new ConfigService({})),
      { deepScanRoutes: true },
    );

    expect(Object.keys(document.paths).sort()).toEqual([
      '/api/v1/orders',
      '/api/v1/orders/version',
      '/api/v1/orders/{id}',
      '/api/v1/orders/{id}/complete',
      '/health',
      '/metrics',
    ].sort());
    expect(document.components?.securitySchemes?.jwt).toEqual(
      expect.objectContaining({ type: 'http', scheme: 'bearer' }),
    );

    const operations = [
      [document.paths['/api/v1/orders']?.post, ['201', '400', '401', '404', '409', '500', '503']],
      [document.paths['/api/v1/orders/{id}']?.get, ['200', '400', '401', '403', '404', '500']],
      [document.paths['/api/v1/orders/{id}/complete']?.post, ['200', '400', '401', '403', '404', '409', '500']],
    ] as const;
    for (const [operation, statuses] of operations) {
      expect(operation?.tags).toEqual(['Pedidos']);
      expect(operation?.security).toEqual([{ jwt: [] }]);
      for (const status of statuses) {
        expect(operation?.responses[status]).toBeDefined();
      }
    }
    expect(
      document.paths['/api/v1/orders/{id}/complete']?.post?.responses['201'],
    ).toBeUndefined();
    expect(
      document.paths['/api/v1/orders/{id}/complete']?.post?.requestBody,
    ).toBeUndefined();

    expect(document.paths['/health']?.get?.tags).toEqual(['Infraestrutura']);

    const version = document.paths['/api/v1/orders/version']?.get;
    expect(version?.tags).toEqual(['Infraestrutura']);
    expect(version?.security).toBeUndefined();
    expect(version?.responses['200']).toBeDefined();

    const metrics = document.paths['/metrics']?.get;
    expect(metrics?.tags).toEqual(['Infraestrutura']);
    expect(metrics?.security).toEqual([{ metrics: [] }]);
    expect(metrics?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '401': expect.any(Object),
      }),
    );
    expect(document.components?.securitySchemes?.metrics).toBeDefined();
    expect(document.components?.schemas).toEqual(
      expect.objectContaining({
        CreateOrderDto: expect.any(Object),
        OrderResponseDto: expect.any(Object),
        ErrorResponseDto: expect.any(Object),
        HealthResponseDto: expect.any(Object),
        VersionResponseDto: expect.any(Object),
      }),
    );

    await app.close();
  });
});
