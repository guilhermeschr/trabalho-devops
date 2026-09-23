import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../domain/user';

export class UserSummaryDto {
  @ApiProperty({
    format: 'uuid',
    example: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
  })
  id!: string;

  @ApiProperty({ example: 'Maria Silva' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com', format: 'email' })
  email!: string;

  static fromDomain(user: User): UserSummaryDto {
    return { id: user.id, name: user.name, email: user.email };
  }
}

export class UserResponseDto extends UserSummaryDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  static override fromDomain(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
