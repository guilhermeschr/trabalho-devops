import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from '../../domain/user';

export function rethrowAuthHttpError(error: unknown): never {
  if (error instanceof EmailAlreadyRegisteredError) {
    throw new ConflictException({
      code: 'EMAIL_ALREADY_REGISTERED',
      message: error.message,
    });
  }

  if (error instanceof InvalidCredentialsError) {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: error.message,
    });
  }

  throw error;
}
