import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Product } from '../../../../domain/product';
import { ProductReadRepository } from '../../../../application/ports/product.repositories';
import { ProductReadOrmEntity } from '../entities/product-read.orm-entity';

export const PRODUCTS_READ_CONNECTION = 'productsRead';

function toDomain(entity: ProductReadOrmEntity): Product {
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

@Injectable()
export class TypeOrmProductReadRepository implements ProductReadRepository {
  constructor(
    @InjectDataSource(PRODUCTS_READ_CONNECTION)
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Product[]> {
    const entities = await this.dataSource
      .getRepository(ProductReadOrmEntity)
      .find();
    return entities.map(toDomain);
  }

  async findById(id: string): Promise<Product | null> {
    const entity = await this.dataSource.getRepository(ProductReadOrmEntity).findOne({
      where: { id },
    });
    return entity ? toDomain(entity) : null;
  }

  async upsertProjection(product: Product): Promise<void> {
    await this.dataSource.getRepository(ProductReadOrmEntity).upsert(
      {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        active: product.active,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      ['id'],
    );
  }
}
