import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max } from 'class-validator';
export class AddStockDto {
  @ApiProperty({
    format: 'uuid',
    example: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
  })
  @IsUUID()
  productId!: string;
  @ApiProperty({ minimum: 1, maximum: 2147483647, example: 20 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;
}
export class DebitStockDto extends AddStockDto {
  @ApiProperty({
    format: 'uuid',
    example: 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc',
  })
  @IsUUID()
  orderId!: string;
}
export class StockResponseDto {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ minimum: 0, example: 20 }) availableQuantity!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
export class DebitResponseDto {
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ example: 2 }) debitedQuantity!: number;
  @ApiProperty({ example: 18 }) remainingQuantity!: number;
}
