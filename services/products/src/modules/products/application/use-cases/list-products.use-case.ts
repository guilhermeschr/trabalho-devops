import { Inject, Injectable } from '@nestjs/common';
import { Product } from '../../domain/product';
import { PRODUCT_READ_REPOSITORY } from '../ports/product.tokens';
import {
  ProductReadFilters,
  ProductReadRepository,
} from '../ports/product.repositories';

@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_READ_REPOSITORY)
    private readonly productReadRepository: ProductReadRepository,
  ) {}

  async execute(filters: ProductReadFilters = {}): Promise<Product[]> {
    return this.productReadRepository.findAll(filters);
  }
}
