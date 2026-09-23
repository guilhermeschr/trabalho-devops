import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import {
  isSwaggerEnabled,
  setupSwagger,
  SWAGGER_TITLE,
} from './swagger.setup';

describe('configuração do Swagger', () => {
  it.each([
    ['development', 'true', true],
    ['development', 'false', false],
    ['production', 'true', false],
    ['PRODUCTION', 'TRUE', false],
  ])('NODE_ENV=%s SWAGGER_ENABLED=%s → %p', (env, enabled, expected) => {
    const config = new ConfigService({
      NODE_ENV: env,
      SWAGGER_ENABLED: enabled,
    });

    expect(isSwaggerEnabled(config)).toBe(expected);
  });

  it('não registra rotas quando desabilitado', () => {
    const setup = jest.spyOn(SwaggerModule, 'setup');

    setupSwagger({} as INestApplication, new ConfigService({}));

    expect(setup).not.toHaveBeenCalled();
    setup.mockRestore();
  });

  it('registra /docs e /docs-json com geração lazy do documento', () => {
    const app = {} as INestApplication;
    const createDocument = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as never);
    const setup = jest
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined as never);

    setupSwagger(
      app,
      new ConfigService({ NODE_ENV: 'development', SWAGGER_ENABLED: 'true' }),
    );

    expect(setup).toHaveBeenCalledWith(
      'docs',
      app,
      expect.any(Function),
      expect.objectContaining({ jsonDocumentUrl: 'docs-json' }),
    );
    expect(createDocument).not.toHaveBeenCalled();

    const factory = setup.mock.calls[0]?.[2] as () => unknown;
    factory();

    expect(createDocument).toHaveBeenCalledWith(
      app,
      expect.objectContaining({
        info: expect.objectContaining({ title: SWAGGER_TITLE }),
      }),
      expect.objectContaining({ deepScanRoutes: true }),
    );

    createDocument.mockRestore();
    setup.mockRestore();
  });
});
