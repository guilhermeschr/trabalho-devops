import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpErrorFilter } from '../../../../common/http-error.filter';
import { RequestIdMiddleware } from '../../../../common/request-id.middleware';
import { CompleteOrderUseCase } from '../../application/use-cases/complete-order.use-case';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import {
  DependencyUnavailableError,
  InsufficientStockError,
  InvalidOrderStatusError,
  Order,
  OrderForbiddenError,
  OrderNotFoundError,
  OrderStatus,
  ProductInactiveError,
  ProductNotFoundError,
} from '../../domain/order';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OrdersController } from './orders.controller';

const SECRET = 'segredo-de-teste';
const USER_ID = '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01';
const PRODUCT_ID = '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20';
const ORDER_ID = 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc';

const order: Order = {
  id: ORDER_ID,
  userId: USER_ID,
  productId: PRODUCT_ID,
  quantity: 2,
  unitPrice: 34.9,
  total: 69.8,
  status: OrderStatus.CREATED,
  createdAt: new Date('2026-09-16T15:20:00.000Z'),
  updatedAt: new Date('2026-09-16T15:20:00.000Z'),
};

describe('OrdersController (HTTP)', () => {
  let app: INestApplication;
  let token: string;
  const createOrder = { execute: jest.fn() };
  const getOrder = { execute: jest.fn() };
  const completeOrder = { execute: jest.fn() };
  const jwtService = new JwtService({ secret: SECRET });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: SECRET }),
        },
        { provide: CreateOrderUseCase, useValue: createOrder },
        { provide: GetOrderUseCase, useValue: getOrder },
        { provide: CompleteOrderUseCase, useValue: completeOrder },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    const requestId = new RequestIdMiddleware();
    app.use(requestId.use.bind(requestId));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpErrorFilter());
    await app.init();
    token = jwtService.sign({ sub: USER_ID, email: 'maria@example.com' });
  });

  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('POST /api/v1/orders', () => {
    const body = { productId: PRODUCT_ID, quantity: 2 };

    it('cria pedido com JWT válido e userId do claim sub', async () => {
      createOrder.execute.mockResolvedValue(order);

      const response = await http()
        .post('/api/v1/orders')
        .set(auth())
        .set('X-Request-Id', 'req-42')
        .send(body)
        .expect(201);

      expect(response.body).toEqual({
        ...order,
        createdAt: '2026-09-16T15:20:00.000Z',
        updatedAt: '2026-09-16T15:20:00.000Z',
      });
      expect(createOrder.execute).toHaveBeenCalledWith(
        { userId: USER_ID, productId: PRODUCT_ID, quantity: 2 },
        { traceId: 'req-42' },
      );
    });

    it('gera traceId quando X-Request-Id não é enviado', async () => {
      createOrder.execute.mockResolvedValue(order);

      await http().post('/api/v1/orders').set(auth()).send(body).expect(201);

      expect(createOrder.execute.mock.calls[0]?.[1].traceId).toMatch(
        /^[0-9a-f-]{36}$/u,
      );
    });

    it('rejeita pedido sem JWT', async () => {
      const response = await http()
        .post('/api/v1/orders')
        .send(body)
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({ status: 401, code: 'UNAUTHORIZED' }),
      );
      expect(createOrder.execute).not.toHaveBeenCalled();
    });

    it.each([
      ['assinado com outro segredo', () => new JwtService({ secret: 'x' }).sign({ sub: USER_ID })],
      ['sem claim sub', () => jwtService.sign({ email: 'maria@example.com' })],
      ['malformado', () => 'abc'],
    ])('rejeita JWT %s', async (_label, build) => {
      await http()
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${build()}`)
        .send(body)
        .expect(401);
      expect(createOrder.execute).not.toHaveBeenCalled();
    });

    it.each([
      [{ productId: 'nao-uuid', quantity: 2 }],
      [{ productId: PRODUCT_ID, quantity: 0 }],
      [{ productId: PRODUCT_ID, quantity: 1.5 }],
      [{ productId: PRODUCT_ID }],
      [{ ...body, userId: USER_ID }],
    ])('retorna 400 para corpo inválido %j', async (invalid) => {
      const response = await http()
        .post('/api/v1/orders')
        .set(auth())
        .send(invalid)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(createOrder.execute).not.toHaveBeenCalled();
    });

    it.each([
      [new ProductNotFoundError(), 404, 'PRODUCT_NOT_FOUND'],
      [new ProductInactiveError(), 409, 'PRODUCT_INACTIVE'],
      [new InsufficientStockError(), 409, 'INSUFFICIENT_STOCK'],
      [
        new DependencyUnavailableError('products-service'),
        503,
        'DEPENDENCY_UNAVAILABLE',
      ],
    ])('mapeia %p para HTTP %p', async (error, status, code) => {
      createOrder.execute.mockRejectedValue(error);

      const response = await http()
        .post('/api/v1/orders')
        .set(auth())
        .send(body)
        .expect(status);

      expect(response.body).toEqual(
        expect.objectContaining({
          status,
          code,
          message: error.message,
          path: '/api/v1/orders',
        }),
      );
    });

    it('retorna 500 genérico para erro inesperado', async () => {
      createOrder.execute.mockRejectedValue(new Error('senha do banco'));

      const response = await http()
        .post('/api/v1/orders')
        .set(auth())
        .send(body)
        .expect(500);

      expect(response.body.message).toBe('Erro interno do servidor');
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('consulta pedido próprio', async () => {
      getOrder.execute.mockResolvedValue(order);

      const response = await http()
        .get(`/api/v1/orders/${ORDER_ID}`)
        .set(auth())
        .expect(200);

      expect(response.body.id).toBe(ORDER_ID);
      expect(getOrder.execute).toHaveBeenCalledWith(ORDER_ID, USER_ID);
    });

    it.each([
      [new OrderNotFoundError(), 404, 'ORDER_NOT_FOUND'],
      [new OrderForbiddenError(), 403, 'ORDER_FORBIDDEN'],
    ])('mapeia %p para HTTP %p', async (error, status, code) => {
      getOrder.execute.mockRejectedValue(error);

      const response = await http()
        .get(`/api/v1/orders/${ORDER_ID}`)
        .set(auth())
        .expect(status);

      expect(response.body.code).toBe(code);
    });

    it('retorna 400 para id que não é UUID', async () => {
      await http().get('/api/v1/orders/abc').set(auth()).expect(400);
      expect(getOrder.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/orders/:id/complete', () => {
    it('conclui pedido próprio com HTTP 200', async () => {
      completeOrder.execute.mockResolvedValue({
        ...order,
        status: OrderStatus.COMPLETED,
      });

      const response = await http()
        .post(`/api/v1/orders/${ORDER_ID}/complete`)
        .set(auth())
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
      expect(completeOrder.execute).toHaveBeenCalledWith(ORDER_ID, USER_ID);
    });

    it.each([
      [new OrderNotFoundError(), 404, 'ORDER_NOT_FOUND'],
      [new OrderForbiddenError(), 403, 'ORDER_FORBIDDEN'],
      [new InvalidOrderStatusError('CANCELLED'), 409, 'INVALID_ORDER_STATUS'],
    ])('mapeia %p para HTTP %p', async (error, status, code) => {
      completeOrder.execute.mockRejectedValue(error);

      const response = await http()
        .post(`/api/v1/orders/${ORDER_ID}/complete`)
        .set(auth())
        .expect(status);

      expect(response.body.code).toBe(code);
    });

    it('rejeita conclusão sem JWT', async () => {
      await http().post(`/api/v1/orders/${ORDER_ID}/complete`).expect(401);
      expect(completeOrder.execute).not.toHaveBeenCalled();
    });
  });
});
