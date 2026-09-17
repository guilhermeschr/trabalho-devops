import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ListProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Identificador UUID exato do produto',
    format: 'uuid',
    example: '33eba94f-f9d2-4d91-bfc7-c272a9067304',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'Parte do nome do produto, sem diferenciar maiúsculas',
    example: 'pizza',
    maxLength: 120,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;
}
