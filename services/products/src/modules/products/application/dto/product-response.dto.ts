import { Product } from '../../domain/product';

export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  price!: number;
  active!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
