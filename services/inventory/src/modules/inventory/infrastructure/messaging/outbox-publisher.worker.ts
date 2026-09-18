import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OUTBOX_REPOSITORY,
  STOCK_EVENT_PUBLISHER,
} from '../../application/ports/stock.tokens';
import {
  OutboxRepository,
  StockEventPublisher,
} from '../../application/ports/stock.repositories';

@Injectable()
export class OutboxPublisherWorker {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private running = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(STOCK_EVENT_PUBLISHER)
    private readonly publisher: StockEventPublisher,
  ) {}

  @Interval(1000)
  async publishPending(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const events = await this.outboxRepository.findPending(50);
      for (const record of events) {
        try {
          await this.publisher.publish({
            eventId: record.eventId,
            eventType: record.eventType as
              'inventory.stock_added' | 'inventory.stock_debited',
            aggregateId: record.aggregateId,
            occurredAt: record.occurredAt,
            version: record.version,
            payload: record.payload,
          });
          await this.outboxRepository.markPublished(record.eventId);
        } catch (error) {
          await this.outboxRepository.markFailed(
            record.eventId,
            error instanceof Error ? error.message : String(error),
          );
          this.logger.warn(
            'Evento de Estoque mantido na Outbox para retry: ' + record.eventId,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
