import { Inject, Injectable } from '@nestjs/common';
import { assertOwner, Order, OrderNotFoundError } from '../../domain/order';
import { OrderRepository } from '../ports/orders.ports';
import { ORDER_REPOSITORY } from '../ports/orders.tokens';

@Injectable()
export class GetOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertOwner(order, userId);
    return order;
  }
}
