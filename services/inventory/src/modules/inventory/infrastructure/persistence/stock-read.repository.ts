import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StockReadRepository } from '../../application/ports/stock.repositories';
import { Stock, StockEvent } from '../../domain/stock';
@Injectable()
export class StockReadSqlRepository implements StockReadRepository {
  constructor(
    @InjectDataSource('inventoryRead') private readonly db: DataSource,
  ) {}
  async findById(productId: string): Promise<Stock | null> {
    const [row] = await this.db.query(
      'SELECT * FROM stock_projection WHERE product_id=$1',
      [productId],
    );
    return row
      ? {
          productId: row.product_id,
          availableQuantity: row.available_quantity,
          updatedAt: row.updated_at,
        }
      : null;
  }
  async project(event: StockEvent): Promise<void> {
    await this.db.transaction(async (manager) => {
      const inserted = await manager.query(
        'INSERT INTO processed_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id',
        [event.eventId],
      );
      if (!inserted.length) return;
      // Version prevents a late event from replacing newer stock. Dedupe and projection commit together.
      await manager.query(
        `INSERT INTO stock_projection(product_id,available_quantity,updated_at,version) VALUES($1,$2,$3,$4) ON CONFLICT(product_id) DO UPDATE SET available_quantity=EXCLUDED.available_quantity, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version WHERE stock_projection.version < EXCLUDED.version`,
        [
          event.payload.productId,
          event.payload.availableQuantity,
          event.payload.updatedAt,
          event.version,
        ],
      );
    });
  }
}
