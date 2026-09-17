import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  status!: number;

  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description: 'Código estável para identificação do erro',
  })
  code!: string;

  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ],
    example: ['name should not be empty'],
  })
  message!: string | string[];

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/products' })
  path!: string;

  @ApiProperty({ example: 'trace-id' })
  traceId!: string;
}
