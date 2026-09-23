import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export const MAX_QUANTITY = 2147483647;

export class CreateOrderDto {
  @ApiProperty({
    description: 'Identificador UUID do produto',
    format: 'uuid',
    example: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: 'Quantidade inteira solicitada',
    minimum: 1,
    maximum: MAX_QUANTITY,
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}
