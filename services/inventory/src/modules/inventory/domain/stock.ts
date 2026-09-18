export type Stock = {
  productId: string;
  availableQuantity: number;
  updatedAt: Date;
};
export type AddStockInput = { productId: string; quantity: number };
export type DebitStockInput = AddStockInput & { orderId: string };
export type DebitResult = {
  orderId: string;
  productId: string;
  debitedQuantity: number;
  remainingQuantity: number;
};
export type StockEvent = {
  eventId: string;
  eventType: 'inventory.stock_added' | 'inventory.stock_debited';
  aggregateId: string;
  occurredAt: Date;
  version: number;
  payload: Stock;
};
export class StockError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
