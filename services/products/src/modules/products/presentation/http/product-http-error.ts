import { NotFoundException } from '@nestjs/common';
import { ProductNotFoundError } from '../../domain/product';

export function rethrowProductHttpError(error: unknown): never {
  if (error instanceof ProductNotFoundError) {
    throw new NotFoundException(error.message);
  }

  throw error;
}
