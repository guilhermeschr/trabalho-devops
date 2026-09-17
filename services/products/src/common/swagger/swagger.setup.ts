import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function isSwaggerEnabled(configService: ConfigService): boolean {
  const enabled = configService
    .get<string>('SWAGGER_ENABLED', 'false')
    .toLowerCase();
  const environment = configService
    .get<string>('NODE_ENV', 'development')
    .toLowerCase();

  return enabled === 'true' && environment !== 'production';
}

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  if (!isSwaggerEnabled(configService)) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Delivery - Microsserviço de Produtos')
    .setDescription(
      `Documentação da API de Produtos. Ambiente: ${configService.get<string>(
        'NODE_ENV',
        'development',
      )}`,
    )
    .setVersion(configService.get<string>('SWAGGER_VERSION', '1.0.0'))
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'jwt',
    )
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });

  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
