import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

@Injectable()
export class LoginUseCase {
  /**
   * Hash de uma senha aleatória, gerado uma vez por processo. Quando o e-mail
   * não existe, a senha é comparada com ele para que o tempo de resposta não
   * revele quais e-mails estão cadastrados. Não há hash fixo no código.
   */
  private unknownUserHash?: Promise<string>;

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
      user?.passwordHash ?? (await this.getUnknownUserHash()),
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

  private getUnknownUserHash(): Promise<string> {
    this.unknownUserHash ??= this.passwordHasher.hash(randomUUID());
    return this.unknownUserHash;
  }
}
