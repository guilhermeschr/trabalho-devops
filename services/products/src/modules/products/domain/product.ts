export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProductInput = {
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
};

export type UpdateProductInput = {
  name: string;
  description?: string | null;
  price: number;
  active: boolean;
};

export type ProductEventType = 'product.created' | 'product.updated';

export type ProductEvent = {
  eventId: string;
  eventType: ProductEventType;
  aggregateId: string;
  occurredAt: Date;
  version: number;
  payload: Product;
};

export class ProductNotFoundError extends Error {
  constructor(id: string) {
    super('Produto não encontrado: ' + id);
    this.name = 'ProductNotFoundError';
  }
}
