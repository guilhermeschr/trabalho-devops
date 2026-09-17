import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OUTBOX_REPOSITORY,
  PRODUCT_EVENT_PUBLISHER,
} from '../../application/ports/product.tokens';
import {
  OutboxRepository,
  ProductEventPublisher,
} from '../../application/ports/product.repositories';

@Injectable()
export class OutboxPublisherWorker {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private running = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(PRODUCT_EVENT_PUBLISHER)
    private readonly publisher: ProductEventPublisher,
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
            eventType: record.eventType as 'product.created' | 'product.updated',
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
            'Evento de Produto mantido na Outbox para retry: ' + record.eventId,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
