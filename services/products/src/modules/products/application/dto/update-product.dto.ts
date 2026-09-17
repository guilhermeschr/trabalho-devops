import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @ApiProperty({
    description: 'Nome do produto',
    example: 'Pizza Margherita especial',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Descrição do produto',
    example: 'Pizza com borda recheada',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    description: 'Preço unitário atualizado do produto',
    example: 44.9,
    minimum: 0.01,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  price!: number;

  @ApiProperty({
    description: 'Indica se o produto pode ser vendido',
    example: true,
  })
  @IsBoolean()
  active!: boolean;
}
