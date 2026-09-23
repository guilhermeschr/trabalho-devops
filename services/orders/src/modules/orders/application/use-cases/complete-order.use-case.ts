import { Inject, Injectable } from '@nestjs/common';
import {
  assertOwner,
  Order,
  OrderNotFoundError,
  requiresCompletion,
} from '../../domain/order';
import { OrderRepository } from '../ports/orders.ports';
import { ORDER_REPOSITORY } from '../ports/orders.tokens';

@Injectable()
export class CompleteOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(orderId: string, userId: string): Promise<Order> {
    const order = await this.findOwned(orderId, userId);

    if (!requiresCompletion(order)) {
      return order;
    }

    const completed = await this.orderRepository.complete(
      orderId,
      new Date(),
    );
    if (completed) {
      return completed;
    }

    // Outra requisição alterou o status entre a leitura e a gravação:
    // reaplica a regra sobre o estado atual.
    const current = await this.findOwned(orderId, userId);
    requiresCompletion(current);
    return current;
  }

  private async findOwned(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertOwner(order, userId);
    return order;
  }
}
