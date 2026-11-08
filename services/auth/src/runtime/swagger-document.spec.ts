import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from '../common/swagger/swagger.setup';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { LoginUseCase } from '../modules/auth/application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../modules/auth/application/use-cases/register-user.use-case';
import { AuthController } from '../modules/auth/presentation/http/auth.controller';
import { BuildInfoService } from '../operations/build-info.service';
import { MetricsService } from '../operations/metrics.service';
import { OperationsController } from '../operations/operations.controller';

describe('contrato OpenAPI do serviço de Auth', () => {
  it('documenta rotas públicas, operacionais, respostas e schemas', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, HealthController, OperationsController],
      providers: [
        { provide: RegisterUserUseCase, useValue: {} },
        { provide: LoginUseCase, useValue: {} },
        { provide: HealthService, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
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
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/version',
      '/health',
      '/metrics',
    ]);

    const register = document.paths['/api/v1/auth/register']?.post;
    expect(register).toEqual(
      expect.objectContaining({
        tags: ['Autenticação'],
        requestBody: expect.objectContaining({
          content: expect.objectContaining({
            'application/json': expect.any(Object),
          }),
        }),
        responses: expect.objectContaining({
          '201': expect.any(Object),
          '400': expect.any(Object),
          '409': expect.any(Object),
          '500': expect.any(Object),
        }),
      }),
    );
    expect(register?.security).toBeUndefined();

    const login = document.paths['/api/v1/auth/login']?.post;
    expect(login).toEqual(
      expect.objectContaining({
        tags: ['Autenticação'],
        responses: expect.objectContaining({
          '200': expect.any(Object),
          '400': expect.any(Object),
          '401': expect.any(Object),
          '500': expect.any(Object),
        }),
      }),
    );
    expect(login?.responses['201']).toBeUndefined();
    expect(login?.security).toBeUndefined();

    expect(document.paths['/health']?.get?.tags).toEqual(['Infraestrutura']);

    const version = document.paths['/api/v1/auth/version']?.get;
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
    expect(document.components?.securitySchemes).toEqual(
      expect.objectContaining({ metrics: expect.any(Object) }),
    );

    expect(document.components?.schemas).toEqual(
      expect.objectContaining({
        RegisterUserDto: expect.any(Object),
        LoginDto: expect.any(Object),
        UserResponseDto: expect.any(Object),
        LoginResponseDto: expect.any(Object),
        ErrorResponseDto: expect.any(Object),
        HealthResponseDto: expect.any(Object),
        VersionResponseDto: expect.any(Object),
      }),
    );

    await app.close();
  });
});
