import { Inject, Injectable } from '@nestjs/common';
import {
  CreateProductInput,
  Product,
} from '../../domain/product';
import {
  PRODUCT_WRITE_REPOSITORY,
} from '../ports/product.tokens';
import { ProductWriteRepository } from '../ports/product.repositories';

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_WRITE_REPOSITORY)
    private readonly productWriteRepository: ProductWriteRepository,
  ) {}

  execute(input: CreateProductInput): Promise<Product> {
    return this.productWriteRepository.create({
      ...input,
      active: input.active ?? true,
    });
  }
}
