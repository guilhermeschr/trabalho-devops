import { Inject, Injectable } from '@nestjs/common';
import { Product, ProductNotFoundError } from '../../domain/product';
import { PRODUCT_READ_REPOSITORY } from '../ports/product.tokens';
import { ProductReadRepository } from '../ports/product.repositories';

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_READ_REPOSITORY)
    private readonly productReadRepository: ProductReadRepository,
  ) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productReadRepository.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }

    return product;
  }
}
