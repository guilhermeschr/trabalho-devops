import {
  CreateProductInput,
  Product,
  ProductEvent,
  UpdateProductInput,
} from '../../domain/product';

export interface ProductWriteRepository {
  create(input: CreateProductInput): Promise<Product>;
  update(id: string, input: UpdateProductInput): Promise<Product>;
}

export interface ProductReadRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  upsertProjection(product: Product): Promise<void>;
}

export interface ProcessedEventRepository {
  hasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

export interface OutboxEventRecord {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: Product;
  occurredAt: Date;
  version: number;
  attempts: number;
}

export interface OutboxRepository {
  findPending(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
}

export interface ProductEventPublisher {
  publish(event: ProductEvent): Promise<void>;
}
