import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import {
  OutboxEventRecord,
  OutboxRepository,
} from '../../../../application/ports/product.repositories';
import { OutboxEventOrmEntity } from '../entities/outbox-event.orm-entity';

@Injectable()
export class TypeOrmOutboxRepository implements OutboxRepository {
  constructor(
    @InjectDataSource('productsWrite')
    private readonly dataSource: DataSource,
  ) {}

  async findPending(limit: number): Promise<OutboxEventRecord[]> {
    const events = await this.dataSource
      .getRepository(OutboxEventOrmEntity)
      .find({
        where: { publishedAt: IsNull() },
        order: { occurredAt: 'ASC' },
        take: limit,
      });

    return events.map((event) => {
      const payload = event.payload as {
        id: string;
        name: string;
        description: string | null;
        price: number;
        active: boolean;
        createdAt: string;
        updatedAt: string;
      };

      return {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: {
          id: payload.id,
          name: payload.name,
          description: payload.description,
          price: Number(payload.price),
          active: payload.active,
          createdAt: new Date(payload.createdAt),
          updatedAt: new Date(payload.updatedAt),
        },
        occurredAt: event.occurredAt,
        version: event.version,
        attempts: event.attempts,
      };
    });
  }

  async markPublished(eventId: string): Promise<void> {
    await this.dataSource.getRepository(OutboxEventOrmEntity).update(
      { eventId },
      { publishedAt: new Date() },
    );
  }

  async markFailed(eventId: string, reason: string): Promise<void> {
    const repository = this.dataSource.getRepository(OutboxEventOrmEntity);
    const event = await repository.findOne({ where: { eventId } });
    if (!event) {
      return;
    }

    event.attempts += 1;
    event.lastError = reason.slice(0, 1000);
    await repository.save(event);
  }
}
