import { ApiProperty } from '@nestjs/swagger';
import { Order, OrderStatus } from '../../domain/order';

export class OrderResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Obtido do claim sub do JWT',
    example: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
  })
  userId!: string;

  @ApiProperty({
    format: 'uuid',
    example: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
  })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({
    example: 34.9,
    description: 'Preço consultado em Produtos no momento da criação',
  })
  unitPrice!: number;

  @ApiProperty({ example: 69.8 })
  total!: number;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CREATED })
  status!: OrderStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  static fromDomain(order: Order): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      productId: order.productId,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
