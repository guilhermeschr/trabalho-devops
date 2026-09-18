import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { StockWriteRepository } from '../../application/ports/stock.repositories';
import {
  Stock,
  AddStockInput,
  DebitStockInput,
  DebitResult,
  StockError,
  StockEvent,
} from '../../domain/stock';
type Row = {
  product_id: string;
  available_quantity: number;
  updated_at: Date;
  version: number;
};
const domain = (row: Row): Stock => ({
  productId: row.product_id,
  availableQuantity: row.available_quantity,
  updatedAt: row.updated_at,
});
@Injectable()
export class StockWriteSqlRepository implements StockWriteRepository {
  constructor(
    @InjectDataSource('inventoryWrite') private readonly db: DataSource,
  ) {}
  async add(input: AddStockInput): Promise<Stock> {
    return this.db.transaction(async (manager) => {
      // Serialize creation and updates of one product, including when no row exists yet.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        ['stock:' + input.productId],
      );
      const rows: Row[] = await manager.query(
        'SELECT * FROM stock WHERE product_id = $1 FOR UPDATE',
        [input.productId],
      );
      const current = rows[0];
      const quantity = (current?.available_quantity ?? 0) + input.quantity;
      if (quantity > 2147483647)
        throw new StockError(
          'STOCK_LIMIT_EXCEEDED',
          'Limite de estoque excedido',
          409,
        );
      const [row]: [Row] = await manager.query(
        `INSERT INTO stock(product_id, available_quantity, version, updated_at) VALUES ($1,$2,1,clock_timestamp()) ON CONFLICT(product_id) DO UPDATE SET available_quantity=$2, version=stock.version+1, updated_at=clock_timestamp() RETURNING *`,
        [input.productId, quantity],
      );
      await this.record(manager, row, input.quantity, 'add', null);
      return domain(row);
    });
  }
  async debit(input: DebitStockInput): Promise<DebitResult> {
    return this.db.transaction(async (manager) => {
      // Lock order first to make retries safe even when the payload changes productId.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        ['order:' + input.orderId],
      );
      const [previous] = await manager.query(
        'SELECT * FROM stock_movements WHERE order_id=$1',
        [input.orderId],
      );
      if (previous) {
        if (
          previous.product_id !== input.productId ||
          previous.quantity !== input.quantity
        )
          throw new StockError(
            'IDEMPOTENCY_CONFLICT',
            'Pedido já utilizado com dados diferentes',
            409,
          );
        return {
          orderId: input.orderId,
          productId: input.productId,
          debitedQuantity: previous.quantity,
          remainingQuantity: previous.remaining_quantity,
        };
      }
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        ['stock:' + input.productId],
      );
      const [current]: Row[] = await manager.query(
        'SELECT * FROM stock WHERE product_id=$1 FOR UPDATE',
        [input.productId],
      );
      if (!current || current.available_quantity < input.quantity)
        throw new StockError(
          'INSUFFICIENT_STOCK',
          'Quantidade solicitada maior que o estoque disponível',
          409,
        );
      const [[row]]: [[Row], number] = await manager.query(
        'UPDATE stock SET available_quantity=available_quantity-$2, version=version+1, updated_at=clock_timestamp() WHERE product_id=$1 RETURNING *',
        [input.productId, input.quantity],
      );
      await this.record(manager, row, input.quantity, 'debit', input.orderId);
      return {
        orderId: input.orderId,
        productId: input.productId,
        debitedQuantity: input.quantity,
        remainingQuantity: row.available_quantity,
      };
    });
  }
  private async record(
    manager: EntityManager,
    row: Row,
    quantity: number,
    kind: 'add' | 'debit',
    orderId: string | null,
  ) {
    await manager.query(
      'INSERT INTO stock_movements(id,order_id,product_id,quantity,kind,remaining_quantity,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        randomUUID(),
        orderId,
        row.product_id,
        quantity,
        kind,
        row.available_quantity,
        row.updated_at,
      ],
    );
    const eventType: StockEvent['eventType'] =
      kind === 'add' ? 'inventory.stock_added' : 'inventory.stock_debited';
    await manager.query(
      'INSERT INTO outbox_events(event_id,event_type,aggregate_id,payload,occurred_at,version) VALUES($1,$2,$3,$4,$5,$6)',
      [
        randomUUID(),
        eventType,
        row.product_id,
        JSON.stringify(domain(row)),
        row.updated_at,
        row.version,
      ],
    );
  }
}
