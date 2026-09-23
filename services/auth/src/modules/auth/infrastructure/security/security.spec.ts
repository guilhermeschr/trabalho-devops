import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';
import { JwtTokenIssuer, parseExpiresIn } from './jwt-token-issuer';

describe('BcryptPasswordHasher', () => {
  it('gera hash bcrypt diferente da senha e compara corretamente', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('SenhaSegura123');

    expect(hash).not.toContain('SenhaSegura123');
    expect(hash).toMatch(/^\$2[ab]\$10\$/u);
    await expect(hasher.compare('SenhaSegura123', hash)).resolves.toBe(true);
    await expect(hasher.compare('outraSenha1', hash)).resolves.toBe(false);
  });
});

describe('parseExpiresIn', () => {
  it.each([
    [undefined, 3600],
    ['', 3600],
    ['900', 900],
    ['3600s', 3600],
    [' 60s ', 60],
  ])('converte %p em %p segundos', (value, expected) => {
    expect(parseExpiresIn(value)).toBe(expected);
  });

  it.each(['0', '-1', '1h', 'abc', '1.5'])('rejeita %p', (value) => {
    expect(() => parseExpiresIn(value)).toThrow('JWT_EXPIRES_IN');
  });
});

describe('JwtTokenIssuer', () => {
  const jwtService = new JwtService();
  const config = new ConfigService({
    JWT_SECRET: 'segredo-de-teste',
    JWT_EXPIRES_IN: '3600s',
  });

  it('emite JWT HS256 com sub, email, iat e exp validável pelo segredo', async () => {
    const issuer = new JwtTokenIssuer(config, jwtService);
    const token = await issuer.issue({
      sub: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
      email: 'maria@example.com',
    });

    expect(token.expiresIn).toBe(3600);
    const payload = jwtService.verify<Record<string, unknown>>(
      token.accessToken,
      { secret: 'segredo-de-teste', algorithms: ['HS256'] },
    );
    expect(payload).toEqual(
      expect.objectContaining({
        sub: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
        email: 'maria@example.com',
        iat: expect.any(Number),
        exp: expect.any(Number),
      }),
    );
    expect(Number(payload.exp) - Number(payload.iat)).toBe(3600);
  });

  it('gera token rejeitado por outro segredo', async () => {
    const issuer = new JwtTokenIssuer(config, jwtService);
    const { accessToken } = await issuer.issue({
      sub: 'user',
      email: 'maria@example.com',
    });

    expect(() =>
      jwtService.verify(accessToken, { secret: 'outro-segredo' }),
    ).toThrow();
  });

  it('exige JWT_SECRET', () => {
    expect(
      () => new JwtTokenIssuer(new ConfigService({}), jwtService),
    ).toThrow();
  });
});
