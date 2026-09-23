import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from '../common/swagger/swagger.setup';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { LoginUseCase } from '../modules/auth/application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../modules/auth/application/use-cases/register-user.use-case';
import { AuthController } from '../modules/auth/presentation/http/auth.controller';

describe('contrato OpenAPI do serviço de Auth', () => {
  it('documenta rotas públicas, health, respostas e schemas', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, HealthController],
      providers: [
        { provide: RegisterUserUseCase, useValue: {} },
        { provide: LoginUseCase, useValue: {} },
        { provide: HealthService, useValue: {} },
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
      '/health',
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

    expect(document.components?.schemas).toEqual(
      expect.objectContaining({
        RegisterUserDto: expect.any(Object),
        LoginDto: expect.any(Object),
        UserResponseDto: expect.any(Object),
        LoginResponseDto: expect.any(Object),
        ErrorResponseDto: expect.any(Object),
        HealthResponseDto: expect.any(Object),
      }),
    );

    await app.close();
  });
});
