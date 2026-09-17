import { Product } from '../../domain/product';
import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({
    description: 'Identificador único do produto',
    format: 'uuid',
    example: '33eba94f-f9d2-4d91-bfc7-c272a9067304',
  })
  id!: string;

  @ApiProperty({ example: 'Pizza Margherita' })
  name!: string;

  @ApiProperty({
    example: 'Pizza com molho de tomate e manjericão',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: 39.9 })
  price!: number;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
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
