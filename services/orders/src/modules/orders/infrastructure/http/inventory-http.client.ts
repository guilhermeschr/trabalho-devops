import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InventoryClient,
  RequestContext,
  StockDebit,
} from '../../application/ports/orders.ports';
import { InsufficientStockError } from '../../domain/order';
import { baseUrl, callInternal, unexpectedResponse } from './internal-http';

const SERVICE = 'inventory-service';

@Injectable()
export class InventoryHttpClient implements InventoryClient {
  private readonly logger = new Logger(InventoryHttpClient.name);

  constructor(private readonly configService: ConfigService) {}

  async debit(debit: StockDebit, context: RequestContext): Promise<void> {
    const url = `${baseUrl(
      this.configService,
      'INVENTORY_SERVICE_URL',
      'http://inventory-service:3000',
    )}/internal/v1/inventory/debit`;
    const response = await callInternal(
      this.configService,
      this.logger,
      SERVICE,
      url,
      { method: 'POST', body: debit },
      context,
    );

    if (response.status === 200) {
      return;
    }

    const code =
      typeof response.body === 'object' && response.body !== null
        ? (response.body as { code?: unknown }).code
        : undefined;
    if (response.status === 409 && code === 'INSUFFICIENT_STOCK') {
      throw new InsufficientStockError();
    }

    throw unexpectedResponse(this.logger, SERVICE, response, context);
  }
}
