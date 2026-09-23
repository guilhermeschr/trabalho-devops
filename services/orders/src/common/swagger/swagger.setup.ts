import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_TITLE = 'Delivery - Microsserviço de Pedidos';

export function isSwaggerEnabled(configService: ConfigService): boolean {
  const enabled = configService
    .get<string>('SWAGGER_ENABLED', 'false')
    .toLowerCase();
  const environment = configService
    .get<string>('NODE_ENV', 'development')
    .toLowerCase();

  return enabled === 'true' && environment !== 'production';
}

export function buildSwaggerConfig(configService: ConfigService) {
  return new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(
      `Criação, consulta e conclusão de pedidos. Pelo gateway, a interface fica em /orders/docs. Ambiente: ${configService.get<string>(
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
}

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  if (!isSwaggerEnabled(configService)) {
    return;
  }

  const swaggerConfig = buildSwaggerConfig(configService);
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
