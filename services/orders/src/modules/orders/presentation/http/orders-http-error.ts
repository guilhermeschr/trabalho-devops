import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DependencyUnavailableError,
  InsufficientStockError,
  InvalidOrderStatusError,
  OrderForbiddenError,
  OrderNotFoundError,
  ProductInactiveError,
  ProductNotFoundError,
} from '../../domain/order';

export function rethrowOrderHttpError(error: unknown): never {
  if (error instanceof OrderNotFoundError) {
    throw new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof OrderForbiddenError) {
    throw new ForbiddenException({
      code: 'ORDER_FORBIDDEN',
      message: error.message,
    });
  }

  if (error instanceof InvalidOrderStatusError) {
    throw new ConflictException({
      code: 'INVALID_ORDER_STATUS',
      message: error.message,
    });
  }

  if (error instanceof ProductNotFoundError) {
    throw new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof ProductInactiveError) {
    throw new ConflictException({
      code: 'PRODUCT_INACTIVE',
      message: error.message,
    });
  }

  if (error instanceof InsufficientStockError) {
    throw new ConflictException({
      code: 'INSUFFICIENT_STOCK',
      message: error.message,
    });
  }

  if (error instanceof DependencyUnavailableError) {
    throw new ServiceUnavailableException({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: error.message,
    });
  }

  throw error;
}
