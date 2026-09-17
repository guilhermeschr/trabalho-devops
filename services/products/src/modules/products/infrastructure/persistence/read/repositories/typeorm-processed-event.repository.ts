import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProcessedEventRepository } from '../../../../application/ports/product.repositories';
import { ProcessedEventOrmEntity } from '../entities/processed-event.orm-entity';

@Injectable()
export class TypeOrmProcessedEventRepository
  implements ProcessedEventRepository
{
  constructor(
    @InjectDataSource('productsRead')
    private readonly dataSource: DataSource,
  ) {}

  async hasProcessed(eventId: string): Promise<boolean> {
    const event = await this.dataSource
      .getRepository(ProcessedEventOrmEntity)
      .findOne({ where: { eventId } });
    return Boolean(event);
  }

  async markProcessed(eventId: string): Promise<void> {
    const event = new ProcessedEventOrmEntity();
    event.eventId = eventId;
    event.processedAt = new Date();
    await this.dataSource.getRepository(ProcessedEventOrmEntity).save(event);
  }
}
