import {
  assertOwner,
  calculateTotal,
  DependencyUnavailableError,
  InvalidOrderStatusError,
  Order,
  OrderForbiddenError,
  OrderStatus,
  requiresCompletion,
} from './order';

const order: Order = {
  id: 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc',
  userId: 'user-1',
  productId: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
  quantity: 2,
  unitPrice: 34.9,
  total: 69.8,
  status: OrderStatus.CREATED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('regras de pedido', () => {
  it.each([
    [34.9, 2, 69.8],
    [0.1, 3, 0.3],
    [19.99, 7, 139.93],
  ])('calcula total de %p x %p = %p sem erro de ponto flutuante', (price, qty, total) => {
    expect(calculateTotal(price, qty)).toBe(total);
  });

  it('aceita o proprietário e rejeita outro usuário', () => {
    expect(() => assertOwner(order, 'user-1')).not.toThrow();
    expect(() => assertOwner(order, 'user-2')).toThrow(OrderForbiddenError);
  });

  it('CREATED exige conclusão e COMPLETED é idempotente', () => {
    expect(requiresCompletion(order)).toBe(true);
    expect(
      requiresCompletion({ ...order, status: OrderStatus.COMPLETED }),
    ).toBe(false);
  });

  it('rejeita transição a partir de status desconhecido', () => {
    expect(() =>
      requiresCompletion({ ...order, status: 'CANCELLED' as OrderStatus }),
    ).toThrow(InvalidOrderStatusError);
  });

  it('identifica o serviço indisponível na mensagem', () => {
    expect(new DependencyUnavailableError('inventory-service').message).toBe(
      'Serviço de Estoque indisponível',
    );
    expect(new DependencyUnavailableError('products-service').service).toBe(
      'products-service',
    );
  });
});
