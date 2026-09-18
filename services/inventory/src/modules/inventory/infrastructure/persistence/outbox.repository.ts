import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  OutboxRepository,
  OutboxEventRecord,
} from '../../application/ports/stock.repositories';
@Injectable()
export class OutboxSqlRepository implements OutboxRepository {
  constructor(
    @InjectDataSource('inventoryWrite') private readonly db: DataSource,
  ) {}
  async findPending(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.db.query(
      'SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at, version LIMIT $1',
      [limit],
    );
    return rows.map((row: any) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      payload: { ...row.payload, updatedAt: new Date(row.payload.updatedAt) },
      occurredAt: row.occurred_at,
      version: row.version,
      attempts: row.attempts,
    }));
  }
  async markPublished(id: string) {
    await this.db.query(
      'UPDATE outbox_events SET published_at=now() WHERE event_id=$1',
      [id],
    );
  }
  async markFailed(id: string, reason: string) {
    await this.db.query(
      'UPDATE outbox_events SET attempts=attempts+1,last_error=$2 WHERE event_id=$1',
      [id, reason.slice(0, 1000)],
    );
  }
}
