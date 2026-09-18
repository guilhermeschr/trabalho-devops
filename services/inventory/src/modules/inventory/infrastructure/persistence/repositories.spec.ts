import { DataSource } from 'typeorm';
import { StockWriteSqlRepository } from './stock-write.repository';
import { StockReadSqlRepository } from './stock-read.repository';
import { OutboxSqlRepository } from './outbox.repository';
const date = new Date();
const row = {
  product_id: 'p',
  available_quantity: 20,
  updated_at: date,
  version: 1,
};
function database() {
  const query = jest.fn();
  const transaction = jest.fn(async (action) => action({ query }));
  return {
    query,
    transaction,
    db: { query, transaction } as unknown as DataSource,
  };
}
describe('Persistência de Estoque', () => {
  it.each([{ current: [] }, { current: [{ ...row, available_quantity: 10 }] }])(
    'cria ou adiciona e registra movimentação + outbox',
    async ({ current }) => {
      const { db, query, transaction } = database();
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce([row])
        .mockResolvedValue([]);
      await expect(
        new StockWriteSqlRepository(db).add({ productId: 'p', quantity: 10 }),
      ).resolves.toEqual({
        productId: 'p',
        availableQuantity: 20,
        updatedAt: date,
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[2][1]).toEqual(['p', current.length ? 20 : 10]);
      expect(query.mock.calls[3][0]).toContain('INSERT INTO stock_movements');
      expect(query.mock.calls[4][1]).toEqual([
        expect.any(String),
        'inventory.stock_added',
        'p',
        expect.any(String),
        date,
        1,
      ]);
    },
  );
  it('rejeita overflow antes de gravar', async () => {
    const { db, query } = database();
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...row, available_quantity: 2147483647 }]);
    await expect(
      new StockWriteSqlRepository(db).add({ productId: 'p', quantity: 1 }),
    ).rejects.toMatchObject({ code: 'STOCK_LIMIT_EXCEEDED' });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('debita sob lock e inclui outbox na transação', async () => {
    const { db, query } = database();
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([
        [{ ...row, available_quantity: 18, version: 2 }],
        1,
      ])
      .mockResolvedValue([]);
    await expect(
      new StockWriteSqlRepository(db).debit({
        productId: 'p',
        orderId: 'o',
        quantity: 2,
      }),
    ).resolves.toEqual({
      productId: 'p',
      orderId: 'o',
      debitedQuantity: 2,
      remainingQuantity: 18,
    });
    expect(query.mock.calls[0][1]).toEqual(['order:o']);
    expect(query.mock.calls[3][0]).toContain('FOR UPDATE');
    expect(query.mock.calls[6][1][1]).toBe('inventory.stock_debited');
  });
  it('retorna resposta original na repetição sem nova escrita', async () => {
    const { db, query } = database();
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { product_id: 'p', quantity: 2, remaining_quantity: 18 },
      ]);
    await expect(
      new StockWriteSqlRepository(db).debit({
        productId: 'p',
        orderId: 'o',
        quantity: 2,
      }),
    ).resolves.toMatchObject({ remainingQuantity: 18 });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it.each([
    { product_id: 'other', quantity: 2 },
    { product_id: 'p', quantity: 3 },
  ])(
    'rejeita reutilização de pedido com payload diferente',
    async (previous) => {
      const { db, query } = database();
      query.mockResolvedValueOnce([]).mockResolvedValueOnce([previous]);
      await expect(
        new StockWriteSqlRepository(db).debit({
          productId: 'p',
          orderId: 'o',
          quantity: 2,
        }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    },
  );
  it.each([{ current: [] }, { current: [{ ...row, available_quantity: 1 }] }])(
    'rejeita estoque ausente ou insuficiente sem escrita',
    async ({ current }) => {
      const { db, query } = database();
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(current);
      await expect(
        new StockWriteSqlRepository(db).debit({
          productId: 'p',
          orderId: 'o',
          quantity: 2,
        }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
      expect(query).toHaveBeenCalledTimes(4);
    },
  );
  it('consulta projeção e retorna null se ausente', async () => {
    const { db, query } = database();
    query.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    const repository = new StockReadSqlRepository(db);
    expect(await repository.findById('p')).toEqual({
      productId: 'p',
      availableQuantity: 20,
      updatedAt: date,
    });
    expect(await repository.findById('p')).toBeNull();
  });
  it('deduplica e aplica projeção com guarda de versão na mesma transação', async () => {
    const { db, query, transaction } = database();
    const repository = new StockReadSqlRepository(db);
    const event: any = {
      eventId: 'e',
      version: 2,
      payload: { productId: 'p', availableQuantity: 18, updatedAt: date },
    };
    query.mockResolvedValueOnce([{ event_id: 'e' }]).mockResolvedValueOnce([]);
    await repository.project(event);
    expect(query.mock.calls[1][0]).toContain(
      'WHERE stock_projection.version < EXCLUDED.version',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    query.mockClear().mockResolvedValue([]);
    await repository.project(event);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('recupera eventos e registra confirmação ou falha', async () => {
    const { db, query } = database();
    const repository = new OutboxSqlRepository(db);
    query.mockResolvedValueOnce([
      {
        event_id: 'e',
        event_type: 'inventory.stock_added',
        aggregate_id: 'p',
        payload: {
          productId: 'p',
          availableQuantity: 20,
          updatedAt: date.toISOString(),
        },
        occurred_at: date,
        version: 1,
        attempts: 0,
      },
    ]);
    expect(await repository.findPending(50)).toEqual([
      expect.objectContaining({
        eventId: 'e',
        payload: { productId: 'p', availableQuantity: 20, updatedAt: date },
      }),
    ]);
    await repository.markPublished('e');
    await repository.markFailed('e', 'x'.repeat(1100));
    expect(query.mock.calls[2][1][1]).toHaveLength(1000);
  });
});
