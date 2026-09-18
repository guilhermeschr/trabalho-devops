import {
  AddStockInput,
  DebitStockInput,
  DebitResult,
  Stock,
  StockEvent,
} from '../../domain/stock';
export interface StockWriteRepository {
  add(input: AddStockInput): Promise<Stock>;
  debit(input: DebitStockInput): Promise<DebitResult>;
}
export interface StockReadRepository {
  findById(productId: string): Promise<Stock | null>;
  project(event: StockEvent): Promise<void>;
}
export interface OutboxEventRecord extends Omit<StockEvent, 'eventType'> {
  eventType: string;
  attempts: number;
}
export interface OutboxRepository {
  findPending(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
}
export interface StockEventPublisher {
  publish(event: StockEvent): Promise<void>;
}
