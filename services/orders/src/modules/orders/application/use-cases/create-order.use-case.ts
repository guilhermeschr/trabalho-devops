import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  calculateTotal,
  Order,
  OrderStatus,
  ProductInactiveError,
} from '../../domain/order';
import {
  InventoryClient,
  OrderRepository,
  ProductsClient,
  RequestContext,
} from '../ports/orders.ports';
import {
  INVENTORY_CLIENT,
  ORDER_REPOSITORY,
  PRODUCTS_CLIENT,
} from '../ports/orders.tokens';

export type CreateOrderInput = {
  userId: string;
  productId: string;
  quantity: number;
};

const SAVE_ATTEMPTS = 2;

@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(PRODUCTS_CLIENT)
    private readonly productsClient: ProductsClient,
    @Inject(INVENTORY_CLIENT)
    private readonly inventoryClient: InventoryClient,
  ) {}

  async execute(
    input: CreateOrderInput,
    context: RequestContext,
  ): Promise<Order> {
    const product = await this.productsClient.getProduct(
      input.productId,
      context,
    );

    if (!product.active) {
      throw new ProductInactiveError();
    }

    // O orderId é gerado antes do débito para que Estoque trate repetições
    // do mesmo pedido de forma idempotente.
    const orderId = randomUUID();
    await this.inventoryClient.debit(
      { orderId, productId: product.id, quantity: input.quantity },
      context,
    );

    const now = new Date();
    return this.save(
      {
        id: orderId,
        userId: input.userId,
        productId: product.id,
        quantity: input.quantity,
        unitPrice: product.price,
        total: calculateTotal(product.price, input.quantity),
        status: OrderStatus.CREATED,
        createdAt: now,
        updatedAt: now,
      },
      context,
    );
  }

  /**
   * O estoque já foi debitado: tenta gravar novamente antes de desistir. Sem
   * rota de estorno em Estoque, a falha definitiva é registrada com orderId e
   * traceId para reconciliação manual.
   */
  private async save(order: Order, context: RequestContext): Promise<Order> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.orderRepository.create(order);
      } catch (error) {
        if (attempt >= SAVE_ATTEMPTS) {
          this.logger.error(
            `Falha ao gravar pedido após débito de estoque orderId=${order.id} traceId=${context.traceId}`,
          );
          throw error;
        }
        this.logger.warn(
          `Nova tentativa de gravação do pedido orderId=${order.id} traceId=${context.traceId}`,
        );
      }
    }
  }
}
