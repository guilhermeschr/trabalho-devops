import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderRepository } from '../../../application/ports/orders.ports';
import { Order, OrderStatus } from '../../../domain/order';
import { OrderOrmEntity } from '../entities/order.orm-entity';

export const ORDERS_CONNECTION = 'orders';

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity, ORDERS_CONNECTION)
    private readonly repository: Repository<OrderOrmEntity>,
  ) {}

  async create(order: Order): Promise<Order> {
    await this.repository.insert(this.repository.create(order));
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async complete(id: string, completedAt: Date): Promise<Order | null> {
    // UPDATE condicional: conclusões simultâneas alteram o pedido uma única vez.
    const result = await this.repository.update(
      { id, status: OrderStatus.CREATED },
      { status: OrderStatus.COMPLETED, updatedAt: completedAt },
    );

    return result.affected ? this.findById(id) : null;
  }

  private toDomain(entity: OrderOrmEntity): Order {
    return {
      id: entity.id,
      userId: entity.userId,
      productId: entity.productId,
      quantity: entity.quantity,
      unitPrice: entity.unitPrice,
      total: entity.total,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
