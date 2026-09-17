import { Inject, Injectable } from '@nestjs/common';
import {
  Product,
  UpdateProductInput,
} from '../../domain/product';
import { PRODUCT_WRITE_REPOSITORY } from '../ports/product.tokens';
import { ProductWriteRepository } from '../ports/product.repositories';

@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_WRITE_REPOSITORY)
    private readonly productWriteRepository: ProductWriteRepository,
  ) {}

  execute(id: string, input: UpdateProductInput): Promise<Product> {
    return this.productWriteRepository.update(id, input);
  }
}
