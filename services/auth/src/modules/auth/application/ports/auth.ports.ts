import { NewUser, User } from '../../domain/user';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  /** Lança EmailAlreadyRegisteredError quando o e-mail já existe. */
  create(user: NewUser): Promise<User>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export type TokenClaims = {
  sub: string;
  email: string;
};

export type IssuedToken = {
  accessToken: string;
  expiresIn: number;
};

export interface TokenIssuer {
  issue(claims: TokenClaims): Promise<IssuedToken>;
}
