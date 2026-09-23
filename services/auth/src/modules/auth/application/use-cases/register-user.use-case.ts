import { Inject, Injectable } from '@nestjs/common';
import {
  EmailAlreadyRegisteredError,
  normalizeEmail,
  User,
} from '../../domain/user';
import { PasswordHasher, UserRepository } from '../ports/auth.ports';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../ports/auth.tokens';

export type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
};

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const email = normalizeEmail(input.email);

    if (await this.userRepository.findByEmail(email)) {
      throw new EmailAlreadyRegisteredError();
    }

    return this.userRepository.create({
      name: input.name.trim(),
      email,
      passwordHash: await this.passwordHasher.hash(input.password),
    });
  }
}
