import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'processed_events' })
export class ProcessedEventOrmEntity {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId!: string;

  @Column({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
