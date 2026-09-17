import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'outbox_events' })
export class OutboxEventOrmEntity {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId!: string;

  @Column({ name: 'event_type', length: 80 })
  eventType!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
