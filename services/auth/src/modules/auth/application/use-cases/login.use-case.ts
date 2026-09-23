import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidCredentialsError,
  normalizeEmail,
  User,
} from '../../domain/user';
import {
  PasswordHasher,
  TokenIssuer,
  UserRepository,
} from '../ports/auth.ports';
import {
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from '../ports/auth.tokens';

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
};

/**
 * Hash bcrypt de uma senha descartável. Quando o e-mail não existe, a senha
 * é comparada com ele para que o tempo de resposta não revele quais e-mails
 * estão cadastrados.
 */
const UNKNOWN_USER_HASH =
  '$2b$10$jxr3pvrSHftA27XA7u3DzuKzmtRptizukpQk2ePenRrBjdA34B3cC';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(
      normalizeEmail(input.email),
    );
    const matches = await this.passwordHasher.compare(
      input.password,
      user?.passwordHash ?? UNKNOWN_USER_HASH,
    );

    if (!user || !matches) {
      throw new InvalidCredentialsError();
    }

    const token = await this.tokenIssuer.issue({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken: token.accessToken,
      tokenType: 'Bearer',
      expiresIn: token.expiresIn,
      user,
    };
  }
}
