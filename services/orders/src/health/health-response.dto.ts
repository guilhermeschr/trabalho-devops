import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'orders-service' })
  service!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;
}
