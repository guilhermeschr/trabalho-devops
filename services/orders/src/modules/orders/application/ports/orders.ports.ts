import { Order } from '../../domain/order';

export interface OrderRepository {
  create(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  /**
   * Conclui somente se o status atual for CREATED. Retorna o pedido
   * atualizado ou null quando outro processo alterou o status antes.
   */
  complete(id: string, completedAt: Date): Promise<Order | null>;
}

/** Contexto da requisição propagado às chamadas entre serviços. */
export type RequestContext = {
  traceId: string;
};

export type CatalogProduct = {
  id: string;
  price: number;
  active: boolean;
};

export interface ProductsClient {
  /**
   * Lança ProductNotFoundError (404) ou DependencyUnavailableError
   * (timeout, rede ou 5xx).
   */
  getProduct(productId: string, context: RequestContext): Promise<CatalogProduct>;
}

export type StockDebit = {
  orderId: string;
  productId: string;
  quantity: number;
};

export interface InventoryClient {
  /**
   * Idempotente por orderId. Lança InsufficientStockError (409) ou
   * DependencyUnavailableError (timeout, rede ou 5xx).
   */
  debit(debit: StockDebit, context: RequestContext): Promise<void>;
}
