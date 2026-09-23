import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterUserDto {
  @ApiProperty({ example: 'Maria Silva', minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 'maria@example.com',
    format: 'email',
    maxLength: 254,
    description: 'Normalizado para letras minúsculas',
  })
  @Transform(trimLower)
  @IsString()
  @MaxLength(254)
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SenhaSegura123',
    format: 'password',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @Length(8, 72)
  password!: string;
}

export const emailTransforms = { trimLower };
