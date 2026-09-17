import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { CreateProductUseCase } from '../modules/products/application/use-cases/create-product.use-case';
import { GetProductUseCase } from '../modules/products/application/use-cases/get-product.use-case';
import { UpdateProductUseCase } from '../modules/products/application/use-cases/update-product.use-case';
import { InternalTokenGuard } from '../modules/products/infrastructure/auth/internal-token.guard';
import { JwtAuthGuard } from '../modules/products/infrastructure/auth/jwt-auth.guard';
import { InternalProductsController } from '../modules/products/presentation/http/internal-products.controller';
import { ProductsController } from '../modules/products/presentation/http/products.controller';

@Module({
  controllers: [
    ProductsController,
    InternalProductsController,
    HealthController,
  ],
  providers: [
    { provide: CreateProductUseCase, useValue: {} },
    { provide: GetProductUseCase, useValue: {} },
    { provide: UpdateProductUseCase, useValue: {} },
    { provide: HealthService, useValue: {} },
    { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
    { provide: InternalTokenGuard, useValue: { canActivate: () => true } },
  ],
})
class SwaggerTestModule {}

describe('contrato OpenAPI do serviço de Produtos', () => {
  it('documenta rotas, segurança, headers, respostas e schemas', async () => {
    const moduleBuilder = Test.createTestingModule({
      imports: [SwaggerTestModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InternalTokenGuard)
      .useValue({ canActivate: () => true });
    const moduleRef = await moduleBuilder.compile();
    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle('Delivery - Microsserviço de Produtos')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'jwt',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    });

    expect(document.paths).toEqual(
      expect.objectContaining({
        '/api/v1/products': expect.objectContaining({
          post: expect.any(Object),
        }),
        '/api/v1/products/{id}': expect.objectContaining({
          get: expect.any(Object),
          put: expect.any(Object),
        }),
        '/internal/v1/products/{id}': expect.objectContaining({
          get: expect.any(Object),
        }),
        '/health': expect.objectContaining({
          get: expect.any(Object),
        }),
      }),
    );

    const createOperation = document.paths['/api/v1/products']?.post;
    expect(createOperation).toEqual(
      expect.objectContaining({
        tags: ['Produtos'],
        security: [{ jwt: [] }],
        responses: expect.objectContaining({
          '201': expect.any(Object),
          '400': expect.any(Object),
          '401': expect.any(Object),
          '500': expect.any(Object),
        }),
      }),
    );

    const internalOperation =
      document.paths['/internal/v1/products/{id}']?.get;
    expect(internalOperation).toEqual(
      expect.objectContaining({
        tags: ['Produtos internos'],
        responses: expect.objectContaining({
          '200': expect.any(Object),
          '403': expect.any(Object),
          '404': expect.any(Object),
          '500': expect.any(Object),
        }),
        parameters: expect.arrayContaining([
          expect.objectContaining({
            name: 'X-Internal-Token',
            in: 'header',
            required: true,
          }),
        ]),
      }),
    );

    const healthOperation = document.paths['/health']?.get;
    expect(healthOperation).toEqual(
      expect.objectContaining({
        tags: ['Infraestrutura'],
        responses: expect.objectContaining({
          '200': expect.any(Object),
        }),
      }),
    );

    expect(document.components?.schemas).toEqual(
      expect.objectContaining({
        CreateProductDto: expect.any(Object),
        UpdateProductDto: expect.any(Object),
        ProductResponseDto: expect.any(Object),
        ErrorResponseDto: expect.any(Object),
        HealthResponseDto: expect.any(Object),
      }),
    );

    await app.close();
  });
});
