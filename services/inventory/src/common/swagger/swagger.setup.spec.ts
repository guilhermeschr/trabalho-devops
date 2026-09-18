import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { isSwaggerEnabled, setupSwagger } from './swagger.setup';

describe('configuração do Swagger', () => {
  it('habilita Swagger em desenvolvimento quando configurado', () => {
    const configService = new ConfigService({
      NODE_ENV: 'development',
      SWAGGER_ENABLED: 'true',
    });

    expect(isSwaggerEnabled(configService)).toBe(true);
  });

  it('desabilita Swagger quando a configuração está falsa', () => {
    const configService = new ConfigService({
      NODE_ENV: 'development',
      SWAGGER_ENABLED: 'false',
    });

    expect(isSwaggerEnabled(configService)).toBe(false);
  });

  it('desabilita Swagger em produção mesmo quando solicitado', () => {
    const configService = new ConfigService({
      NODE_ENV: 'stockion',
      SWAGGER_ENABLED: 'true',
    });

    expect(isSwaggerEnabled(configService)).toBe(false);
  });

  it('configura UI, JSON e autenticação JWT com geração lazy', () => {
    const app = {} as INestApplication;
    const configService = new ConfigService({
      NODE_ENV: 'development',
      SWAGGER_ENABLED: 'true',
    });
    const createDocument = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as never);
    const setup = jest
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined as never);

    setupSwagger(app, configService);

    expect(setup).toHaveBeenCalledWith(
      'docs',
      app,
      expect.any(Function),
      expect.objectContaining({
        jsonDocumentUrl: 'docs-json',
      }),
    );

    const setupCall = setup.mock.calls[0];
    if (!setupCall) {
      throw new Error('SwaggerModule.setup não foi chamado');
    }

    const documentFactory = setupCall[2];
    if (typeof documentFactory !== 'function') {
      throw new Error('Swagger deve usar uma factory lazy');
    }

    documentFactory();

    expect(createDocument).toHaveBeenCalledWith(
      app,
      expect.objectContaining({
        info: expect.objectContaining({
          title: 'Delivery - Microsserviço de Estoque',
        }),
        components: expect.objectContaining({
          securitySchemes: expect.objectContaining({
            jwt: expect.objectContaining({
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            }),
          }),
        }),
      }),
      expect.objectContaining({
        deepScanRoutes: true,
      }),
    );

    createDocument.mockRestore();
    setup.mockRestore();
  });
});
