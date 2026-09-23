import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogProduct,
  ProductsClient,
  RequestContext,
} from '../../application/ports/orders.ports';
import { ProductNotFoundError } from '../../domain/order';
import { baseUrl, callInternal, unexpectedResponse } from './internal-http';

const SERVICE = 'products-service';

@Injectable()
export class ProductsHttpClient implements ProductsClient {
  private readonly logger = new Logger(ProductsHttpClient.name);

  constructor(private readonly configService: ConfigService) {}

  async getProduct(
    productId: string,
    context: RequestContext,
  ): Promise<CatalogProduct> {
    const url = `${baseUrl(
      this.configService,
      'PRODUCTS_SERVICE_URL',
      'http://products-service:3000',
    )}/internal/v1/products/${encodeURIComponent(productId)}`;
    const response = await callInternal(
      this.configService,
      this.logger,
      SERVICE,
      url,
      { method: 'GET' },
      context,
    );

    if (response.status === 404) {
      throw new ProductNotFoundError();
    }

    const body = response.body as Partial<CatalogProduct> | undefined;
    if (
      response.status !== 200 ||
      typeof body?.id !== 'string' ||
      typeof body.price !== 'number' ||
      typeof body.active !== 'boolean'
    ) {
      throw unexpectedResponse(this.logger, SERVICE, response, context);
    }

    return { id: body.id, price: body.price, active: body.active };
  }
}
