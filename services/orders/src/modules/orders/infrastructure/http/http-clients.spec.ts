import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DependencyUnavailableError,
  InsufficientStockError,
  ProductNotFoundError,
} from '../../domain/order';
import { InventoryHttpClient } from './inventory-http.client';
import { ProductsHttpClient } from './products-http.client';

const PRODUCT_ID = '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20';
const ORDER_ID = 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc';
const context = { traceId: 'req-9' };
const config = new ConfigService({
  INTERNAL_SERVICE_TOKEN: 'token-interno',
  PRODUCTS_SERVICE_URL: 'http://products:3000/',
  INVENTORY_SERVICE_URL: 'http://inventory:3000',
  ORDERS_HTTP_TIMEOUT_MS: '1500',
});

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('clientes REST internos', () => {
  const fetchMock = jest.fn();
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  beforeEach(() => {
    fetchMock.mockReset();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('ProductsHttpClient', () => {
    const client = () => new ProductsHttpClient(config);

    it('consulta a rota interna com token, traceId e timeout', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: PRODUCT_ID, name: 'X', price: 34.9, active: true }),
      );

      await expect(client().getProduct(PRODUCT_ID, context)).resolves.toEqual({
        id: PRODUCT_ID,
        price: 34.9,
        active: true,
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://products:3000/internal/v1/products/${PRODUCT_ID}`);
      expect(init).toEqual(
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Internal-Token': 'token-interno',
            'X-Request-Id': 'req-9',
          },
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('traduz 404 para produto inexistente', async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { code: 'NOT_FOUND' }));

      await expect(client().getProduct(PRODUCT_ID, context)).rejects.toBeInstanceOf(
        ProductNotFoundError,
      );
    });

    it.each([
      ['timeout', Object.assign(new Error('t'), { name: 'TimeoutError' }), 'timeout'],
      ['rede', new TypeError('fetch failed'), 'falha de conexão'],
    ])('trata %s como dependência indisponível e registra o traceId', async (_l, failure, reason) => {
      fetchMock.mockRejectedValue(failure);

      await expect(client().getProduct(PRODUCT_ID, context)).rejects.toEqual(
        new DependencyUnavailableError('products-service'),
      );
      expect(warn).toHaveBeenCalledWith(
        `Dependência indisponível service=products-service reason=${reason} traceId=req-9`,
      );
    });

    it('trata 5xx como dependência indisponível', async () => {
      fetchMock.mockResolvedValue(new Response('erro', { status: 502 }));

      await expect(client().getProduct(PRODUCT_ID, context)).rejects.toBeInstanceOf(
        DependencyUnavailableError,
      );
    });

    it.each([
      [403, { code: 'FORBIDDEN' }],
      [200, { id: PRODUCT_ID }],
    ])('trata resposta inesperada HTTP %p como erro interno', async (status, body) => {
      fetchMock.mockResolvedValue(jsonResponse(status, body));

      await expect(client().getProduct(PRODUCT_ID, context)).rejects.toThrow(
        'Resposta inesperada de products-service',
      );
      expect(error).toHaveBeenCalled();
    });

    it('usa timeout padrão quando a configuração é inválida', async () => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      fetchMock.mockResolvedValue(
        jsonResponse(200, { id: PRODUCT_ID, price: 1, active: true }),
      );

      await new ProductsHttpClient(
        new ConfigService({
          INTERNAL_SERVICE_TOKEN: 't',
          ORDERS_HTTP_TIMEOUT_MS: 'abc',
        }),
      ).getProduct(PRODUCT_ID, context);

      expect(timeout).toHaveBeenCalledWith(3000);
      expect(fetchMock.mock.calls[0]?.[0]).toContain('http://products-service:3000/');
    });
  });

  describe('InventoryHttpClient', () => {
    const client = () => new InventoryHttpClient(config);
    const debit = { orderId: ORDER_ID, productId: PRODUCT_ID, quantity: 2 };

    it('debita via POST JSON com orderId', async () => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      fetchMock.mockResolvedValue(
        jsonResponse(200, { ...debit, debitedQuantity: 2, remainingQuantity: 18 }),
      );

      await expect(client().debit(debit, context)).resolves.toBeUndefined();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://inventory:3000/internal/v1/inventory/debit');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual(
        expect.objectContaining({ 'Content-Type': 'application/json' }),
      );
      expect(JSON.parse(init.body as string)).toEqual(debit);
      expect(timeout).toHaveBeenCalledWith(1500);
    });

    it('traduz 409 INSUFFICIENT_STOCK', async () => {
      fetchMock.mockResolvedValue(jsonResponse(409, { code: 'INSUFFICIENT_STOCK' }));

      await expect(client().debit(debit, context)).rejects.toBeInstanceOf(
        InsufficientStockError,
      );
    });

    it('trata indisponibilidade de Estoque como 503', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

      await expect(client().debit(debit, context)).rejects.toEqual(
        new DependencyUnavailableError('inventory-service'),
      );
    });

    it.each([
      [409, { code: 'IDEMPOTENCY_CONFLICT' }],
      [403, undefined],
    ])('trata resposta inesperada HTTP %p como erro interno', async (status, body) => {
      fetchMock.mockResolvedValue(jsonResponse(status, body));

      await expect(client().debit(debit, context)).rejects.toThrow(
        'Resposta inesperada de inventory-service',
      );
    });
  });
});
