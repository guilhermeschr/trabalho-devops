import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  CreateProductInput,
  Product,
  ProductEvent,
  ProductNotFoundError,
  UpdateProductInput,
} from '../../../../domain/product';
import { ProductWriteRepository } from '../../../../application/ports/product.repositories';
import { OutboxEventOrmEntity } from '../entities/outbox-event.orm-entity';
import { ProductWriteOrmEntity } from '../entities/product-write.orm-entity';

export const PRODUCTS_WRITE_CONNECTION = 'productsWrite';

function toDomain(entity: ProductWriteOrmEntity): Product {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    price: Number(entity.price),
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function toOutboxEntity(event: ProductEvent): OutboxEventOrmEntity {
  const entity = new OutboxEventOrmEntity();
  entity.eventId = event.eventId;
  entity.eventType = event.eventType;
  entity.aggregateId = event.aggregateId;
  entity.payload = {
    ...event.payload,
    createdAt: event.payload.createdAt.toISOString(),
    updatedAt: event.payload.updatedAt.toISOString(),
  };
  entity.occurredAt = event.occurredAt;
  entity.version = event.version;
  entity.publishedAt = null;
  entity.attempts = 0;
  entity.lastError = null;
  return entity;
}

@Injectable()
export class TypeOrmProductWriteRepository
  implements ProductWriteRepository
{
  constructor(
    @InjectDataSource(PRODUCTS_WRITE_CONNECTION)
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateProductInput): Promise<Product> {
    const now = new Date();
    const entity = new ProductWriteOrmEntity();
    entity.id = randomUUID();
    entity.name = input.name;
    entity.description = input.description ?? null;
    entity.price = input.price;
    entity.active = input.active ?? true;
    entity.createdAt = now;
    entity.updatedAt = now;

    const product = toDomain(entity);
    const event: ProductEvent = {
      eventId: randomUUID(),
      eventType: 'product.created',
      aggregateId: product.id,
      occurredAt: now,
      version: 1,
      payload: product,
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.save(ProductWriteOrmEntity, entity);
      await manager.save(OutboxEventOrmEntity, toOutboxEntity(event));
    });

    return product;
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const now = new Date();
    let updatedProduct: Product | undefined;

    await this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOne(ProductWriteOrmEntity, {
        where: { id },
      });

      if (!entity) {
        throw new ProductNotFoundError(id);
      }

      entity.name = input.name;
      entity.description = input.description ?? null;
      entity.price = input.price;
      entity.active = input.active;
      entity.updatedAt = now;
      updatedProduct = toDomain(entity);
      const event: ProductEvent = {
        eventId: randomUUID(),
        eventType: 'product.updated',
        aggregateId: id,
        occurredAt: now,
        version: 1,
        payload: updatedProduct,
      };

      await manager.save(ProductWriteOrmEntity, entity);
      await manager.save(OutboxEventOrmEntity, toOutboxEntity(event));
    });

    if (!updatedProduct) {
      throw new ProductNotFoundError(id);
    }

    return updatedProduct;
  }
}
