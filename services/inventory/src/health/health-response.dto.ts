import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'inventory-service' })
  service!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;
}
