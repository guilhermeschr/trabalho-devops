import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalTokenGuard } from './internal-token.guard';

function contextFor(token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token ? { 'x-internal-token': token } : {},
      }),
    }),
  } as ExecutionContext;
}

describe('InternalTokenGuard', () => {
  it('permite token interno válido', () => {
    const guard = new InternalTokenGuard({
      getOrThrow: jest.fn().mockReturnValue('shared-token'),
    } as unknown as ConfigService);

    expect(guard.canActivate(contextFor('shared-token'))).toBe(true);
  });

  it('rejeita token interno ausente ou inválido', () => {
    const guard = new InternalTokenGuard({
      getOrThrow: jest.fn().mockReturnValue('shared-token'),
    } as unknown as ConfigService);

    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('outro-token'))).toThrow(
      ForbiddenException,
    );
  });
});
