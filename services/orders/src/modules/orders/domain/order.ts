export enum OrderStatus {
  CREATED = 'CREATED',
  COMPLETED = 'COMPLETED',
}

export type Order = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DependencyName = 'products-service' | 'inventory-service';

const DEPENDENCY_LABELS: Record<DependencyName, string> = {
  'products-service': 'Produtos',
  'inventory-service': 'Estoque',
};

export class OrderNotFoundError extends Error {
  constructor() {
    super('Pedido não encontrado');
  }
}

export class OrderForbiddenError extends Error {
  constructor() {
    super('Pedido pertence a outro usuário');
  }
}

export class InvalidOrderStatusError extends Error {
  constructor(status: string) {
    super(`Pedido com status ${status} não pode ser concluído`);
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super('Produto não encontrado');
  }
}

export class ProductInactiveError extends Error {
  constructor() {
    super('Produto inativo não pode ser pedido');
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super('Quantidade solicitada maior que o estoque disponível');
  }
}

export class DependencyUnavailableError extends Error {
  constructor(readonly service: DependencyName) {
    super(`Serviço de ${DEPENDENCY_LABELS[service]} indisponível`);
  }
}

/** Calcula em centavos inteiros para evitar erro de ponto flutuante. */
export function calculateTotal(unitPrice: number, quantity: number): number {
  return (Math.round(unitPrice * 100) * quantity) / 100;
}

export function assertOwner(order: Order, userId: string): void {
  if (order.userId !== userId) {
    throw new OrderForbiddenError();
  }
}

/**
 * Regra de conclusão: CREATED pode ser concluído; COMPLETED já está no estado
 * final (repetição idempotente); qualquer outro status é transição inválida.
 * Retorna true quando a conclusão ainda precisa ser gravada.
 */
export function requiresCompletion(order: Order): boolean {
  if (order.status === OrderStatus.CREATED) {
    return true;
  }

  if (order.status === OrderStatus.COMPLETED) {
    return false;
  }

  throw new InvalidOrderStatusError(order.status);
}
