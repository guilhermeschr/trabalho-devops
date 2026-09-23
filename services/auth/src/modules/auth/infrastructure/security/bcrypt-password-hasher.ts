import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../application/ports/auth.ports';

export const BCRYPT_COST = 10;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
