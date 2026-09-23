import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 3600, description: 'Validade do token em segundos' })
  expiresIn!: number;

  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;
}
