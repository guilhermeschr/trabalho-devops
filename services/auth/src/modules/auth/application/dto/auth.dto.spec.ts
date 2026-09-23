import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterUserDto } from './register-user.dto';

async function errorsFor<T extends object>(
  type: new () => T,
  body: Record<string, unknown>,
) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, properties: errors.map((error) => error.property) };
}

const valid = {
  name: 'Maria Silva',
  email: 'maria@example.com',
  password: 'SenhaSegura123',
};

describe('RegisterUserDto', () => {
  it('aceita cadastro válido e normaliza nome e e-mail', async () => {
    const { dto, properties } = await errorsFor(RegisterUserDto, {
      ...valid,
      name: '  Maria Silva ',
      email: '  Maria@Example.com ',
    });

    expect(properties).toEqual([]);
    expect(dto.name).toBe('Maria Silva');
    expect(dto.email).toBe('maria@example.com');
  });

  it.each([
    ['senha curta', { password: '1234567' }, 'password'],
    ['senha longa', { password: 'a'.repeat(73) }, 'password'],
    ['senha não textual', { password: 12345678 }, 'password'],
    ['e-mail inválido', { email: 'maria' }, 'email'],
    ['nome vazio', { name: '   ' }, 'name'],
    ['nome longo', { name: 'a'.repeat(121) }, 'name'],
  ])('rejeita %s', async (_label, override, property) => {
    const { properties } = await errorsFor(RegisterUserDto, {
      ...valid,
      ...override,
    });

    expect(properties).toContain(property);
  });

  it('aceita senha nos limites de 8 e 72 caracteres', async () => {
    for (const password of ['a'.repeat(8), 'a'.repeat(72)]) {
      const { properties } = await errorsFor(RegisterUserDto, {
        ...valid,
        password,
      });
      expect(properties).toEqual([]);
    }
  });

  it('rejeita campos desconhecidos', async () => {
    const { properties } = await errorsFor(RegisterUserDto, {
      ...valid,
      role: 'admin',
    });

    expect(properties).toContain('role');
  });
});

describe('LoginDto', () => {
  it('normaliza e-mail e exige senha', async () => {
    const ok = await errorsFor(LoginDto, {
      email: ' MARIA@example.com',
      password: 'x',
    });
    expect(ok.properties).toEqual([]);
    expect(ok.dto.email).toBe('maria@example.com');

    const missing = await errorsFor(LoginDto, { email: 'maria@example.com' });
    expect(missing.properties).toContain('password');
  });
});
