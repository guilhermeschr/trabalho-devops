import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import {
  InventoryController,
  InternalInventoryController,
} from './inventory.controller';
import {
  AddStockUseCase,
  DebitStockUseCase,
  GetStockUseCase,
} from '../../application/use-cases/stock.use-cases';
import { HttpErrorFilter } from '../../../../common/http-error.filter';
import { StockError } from '../../domain/stock';
const productId = '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20';
const orderId = 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc';
describe('HTTP e contrato Swagger de Estoque', () => {
  let app: INestApplication;
  const add = { execute: jest.fn() },
    get = { execute: jest.fn() },
    debit = { execute: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController, InternalInventoryController],
      providers: [
        { provide: AddStockUseCase, useValue: add },
        { provide: GetStockUseCase, useValue: get },
        { provide: DebitStockUseCase, useValue: debit },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'JWT_SECRET' ? 'jwt-secret' : 'internal-secret',
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: (token: string) => {
              if (token !== 'valid') throw new Error('invalid');
              return { sub: 'user' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpErrorFilter());
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('exige JWT e token interno', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .send({ productId, quantity: 2 })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/inventory/' + productId)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    await request(app.getHttpServer())
      .post('/internal/v1/inventory/debit')
      .send({ productId, orderId, quantity: 2 })
      .expect(403);
  });
  it('retorna 200 para adição, consulta e débito', async () => {
    const stock = {
      productId,
      availableQuantity: 20,
      updatedAt: new Date().toISOString(),
    };
    add.execute.mockResolvedValue(stock);
    get.execute.mockResolvedValue(stock);
    debit.execute.mockResolvedValue({
      orderId,
      productId,
      debitedQuantity: 2,
      remainingQuantity: 18,
    });
    await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Authorization', 'Bearer valid')
      .send({ productId, quantity: 20 })
      .expect(200, stock);
    await request(app.getHttpServer())
      .get('/api/v1/inventory/' + productId)
      .set('Authorization', 'Bearer valid')
      .expect(200, stock);
    const response = await request(app.getHttpServer())
      .post('/internal/v1/inventory/debit')
      .set('X-Internal-Token', 'internal-secret')
      .send({ productId, orderId, quantity: 2 })
      .expect(200);
    expect(response.body.remainingQuantity).toBe(18);
  });
  it.each([0, -1, 1.5, '2', 2147483648])(
    'valida quantidade %s',
    async (quantity) => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory')
        .set('Authorization', 'Bearer valid')
        .send({ productId, quantity })
        .expect(400);
      expect(add.execute).not.toHaveBeenCalled();
    },
  );
  it('valida UUID, orderId e campos extras', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/invalid')
      .set('Authorization', 'Bearer valid')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Authorization', 'Bearer valid')
      .send({ productId: 'invalid', quantity: 2 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/internal/v1/inventory/debit')
      .set('X-Internal-Token', 'internal-secret')
      .send({ productId, quantity: 2 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Authorization', 'Bearer valid')
      .send({ productId, quantity: 2, extra: true })
      .expect(400);
  });
  it('preserva códigos de domínio e oculta detalhes de falhas inesperadas', async () => {
    debit.execute.mockRejectedValue(
      new StockError('INSUFFICIENT_STOCK', 'Estoque insuficiente', 409),
    );
    const response = await request(app.getHttpServer())
      .post('/internal/v1/inventory/debit')
      .set('X-Internal-Token', 'internal-secret')
      .set('X-Request-Id', 'trace')
      .send({ productId, orderId, quantity: 2 })
      .expect(409);
    expect(response.body).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      traceId: 'trace',
    });
    get.execute.mockRejectedValue(
      new StockError('STOCK_NOT_FOUND', 'Estoque não encontrado', 404),
    );
    await request(app.getHttpServer())
      .get('/api/v1/inventory/' + productId)
      .set('Authorization', 'Bearer valid')
      .expect(404);
    add.execute.mockRejectedValue(new Error('sensitive'));
    const result = await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Authorization', 'Bearer valid')
      .send({ productId, quantity: 2 })
      .expect(500);
    expect(result.body.message).toBe('Erro interno do servidor');
  });
  it('documenta rotas, headers, schemas, validações e respostas', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'jwt').build(),
    );
    const add = doc.paths['/api/v1/inventory']!.post!;
    expect(add.responses['200']).toBeDefined();
    expect(add.security).toEqual([{ jwt: [] }]);
    expect(doc.paths['/api/v1/inventory/{productId}']!.get!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'productId', required: true }),
      ]),
    );
    const debit = doc.paths['/internal/v1/inventory/debit']!.post!;
    expect(debit.responses['403']).toBeDefined();
    expect(debit.responses['409']).toBeDefined();
    expect(debit.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'X-Internal-Token', required: true }),
      ]),
    );
    for (const schema of [
      'AddStockDto',
      'DebitStockDto',
      'StockResponseDto',
      'DebitResponseDto',
      'ErrorResponseDto',
    ])
      expect(doc.components!.schemas![schema]).toBeDefined();
  });
});
