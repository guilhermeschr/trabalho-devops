import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
import { LoginResponseDto } from '../../application/dto/login-response.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { RegisterUserDto } from '../../application/dto/register-user.dto';
import {
  UserResponseDto,
  UserSummaryDto,
} from '../../application/dto/user-response.dto';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { rethrowAuthHttpError } from './auth-http-error';

@Controller('api/v1/auth')
@ApiTags('Autenticação')
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Dados inválidos ou campos desconhecidos (VALIDATION_ERROR)',
})
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Cadastrar usuário',
    description:
      'Rota pública. O e-mail é normalizado para minúsculas e a senha, com 8 a 72 caracteres, é armazenada somente como hash bcrypt.',
  })
  @ApiBody({ type: RegisterUserDto })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'E-mail já cadastrado (EMAIL_ALREADY_REGISTERED)',
  })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    try {
      return UserResponseDto.fromDomain(await this.registerUser.execute(dto));
    } catch (error) {
      rethrowAuthHttpError(error);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuário e emitir JWT',
    description:
      'Rota pública. Retorna um JWT HS256 com os claims sub, email, iat e exp.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'E-mail ou senha incorretos (INVALID_CREDENTIALS)',
  })
  async authenticate(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    try {
      const result = await this.login.execute(dto);
      return {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        user: UserSummaryDto.fromDomain(result.user),
      };
    } catch (error) {
      rethrowAuthHttpError(error);
    }
  }
}
