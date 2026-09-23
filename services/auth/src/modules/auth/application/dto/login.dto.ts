import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { emailTransforms } from './register-user.dto';

export class LoginDto {
  @ApiProperty({ example: 'maria@example.com', format: 'email' })
  @Transform(emailTransforms.trimLower)
  @IsString()
  @MaxLength(254)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SenhaSegura123', format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}
