import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextFor(request: {
  headers: { authorization?: string };
  user?: Record<string, unknown>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

function configFor(
  secret = 'secret',
  env: Record<string, string> = {},
): ConfigService {
  return {
    get: jest.fn((key: string) => env[key]),
    getOrThrow: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
}

describe('JwtAuthGuard', () => {
  it('exige JWT mesmo com AUTH_ENABLED=false no ambiente', () => {
    const jwtService = { verify: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      configFor('secret', { AUTH_ENABLED: 'false', NODE_ENV: 'production' }),
      jwtService,
    );

    expect(() =>
      guard.canActivate(
        contextFor({
          headers: {},
        }),
      ),
    ).toThrow(UnauthorizedException);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('valida o bearer token e salva o usuário na requisição', () => {
    const request: {
      headers: { authorization?: string };
      user?: Record<string, unknown>;
    } = { headers: { authorization: 'Bearer token' } };
    const jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(configFor(), jwtService);

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.user).toEqual({ sub: 'user-1' });
    expect(jwtService.verify).toHaveBeenCalledWith('token', {
      secret: 'secret',
    });
  });

  it('rejeita requisição sem bearer token', () => {
    const guard = new JwtAuthGuard(
      configFor(),
      { verify: jest.fn() } as unknown as JwtService,
    );

    expect(() =>
      guard.canActivate(
        contextFor({
          headers: {},
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita JWT inválido', () => {
    const guard = new JwtAuthGuard(
      configFor(),
      {
        verify: jest.fn().mockImplementation(() => {
          throw new Error('assinatura inválida');
        }),
      } as unknown as JwtService,
    );

    expect(() =>
      guard.canActivate(
        contextFor({
          headers: { authorization: 'Bearer inválido' },
        }),
      ),
    ).toThrow(UnauthorizedException);
  });
});
