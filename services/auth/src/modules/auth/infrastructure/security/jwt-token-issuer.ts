import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  IssuedToken,
  TokenClaims,
  TokenIssuer,
} from '../../application/ports/auth.ports';

export const DEFAULT_EXPIRES_IN_SECONDS = 3600;

/** Aceita segundos, com sufixo `s` opcional: `3600` ou `3600s`. */
export function parseExpiresIn(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_EXPIRES_IN_SECONDS;
  }

  const match = /^(\d+)s?$/u.exec(value.trim());
  const seconds = match ? Number(match[1]) : Number.NaN;

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      'JWT_EXPIRES_IN deve ser um número positivo de segundos, como 3600 ou 3600s',
    );
  }

  return seconds;
}

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  private readonly secret: string;
  private readonly expiresIn: number;

  constructor(
    configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.secret = configService.getOrThrow<string>('JWT_SECRET');
    this.expiresIn = parseExpiresIn(
      configService.get<string>('JWT_EXPIRES_IN'),
    );
  }

  async issue(claims: TokenClaims): Promise<IssuedToken> {
    const accessToken = await this.jwtService.signAsync(
      { sub: claims.sub, email: claims.email },
      {
        secret: this.secret,
        algorithm: 'HS256',
        expiresIn: this.expiresIn,
      },
    );

    return { accessToken, expiresIn: this.expiresIn };
  }
}
