import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  User,
} from '../../domain/user';
import {
  PasswordHasher,
  TokenIssuer,
  UserRepository,
} from '../ports/auth.ports';
import { LoginUseCase } from './login.use-case';
import { RegisterUserUseCase } from './register-user.use-case';

const user: User = {
  id: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
  name: 'Maria Silva',
  email: 'maria@example.com',
  passwordHash: '$2b$10$hash',
  createdAt: new Date('2026-09-16T15:00:00.000Z'),
};

function mocks() {
  const repository: jest.Mocked<UserRepository> = {
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(user),
  };
  const hasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn().mockResolvedValue('$2b$10$hash'),
    compare: jest.fn().mockResolvedValue(true),
  };
  const issuer: jest.Mocked<TokenIssuer> = {
    issue: jest.fn().mockResolvedValue({ accessToken: 'jwt', expiresIn: 3600 }),
  };
  return { repository, hasher, issuer };
}

describe('RegisterUserUseCase', () => {
  it('cadastra usuário com e-mail normalizado e senha somente como hash', async () => {
    const { repository, hasher } = mocks();
    const useCase = new RegisterUserUseCase(repository, hasher);

    await expect(
      useCase.execute({
        name: ' Maria Silva ',
        email: ' Maria@Example.COM ',
        password: 'SenhaSegura123',
      }),
    ).resolves.toEqual(user);

    expect(repository.findByEmail).toHaveBeenCalledWith('maria@example.com');
    expect(hasher.hash).toHaveBeenCalledWith('SenhaSegura123');
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Maria Silva',
      email: 'maria@example.com',
      passwordHash: '$2b$10$hash',
    });
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(
      'SenhaSegura123',
    );
  });

  it('rejeita e-mail já cadastrado sem gerar hash', async () => {
    const { repository, hasher } = mocks();
    repository.findByEmail.mockResolvedValue(user);
    const useCase = new RegisterUserUseCase(repository, hasher);

    await expect(
      useCase.execute({
        name: 'Maria',
        email: 'MARIA@example.com',
        password: 'SenhaSegura123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('propaga conflito detectado pelo banco em cadastro concorrente', async () => {
    const { repository, hasher } = mocks();
    repository.create.mockRejectedValue(new EmailAlreadyRegisteredError());
    const useCase = new RegisterUserUseCase(repository, hasher);

    await expect(
      useCase.execute({
        name: 'Maria',
        email: 'maria@example.com',
        password: 'SenhaSegura123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});

describe('LoginUseCase', () => {
  it('emite JWT com sub e email para credenciais válidas', async () => {
    const { repository, hasher, issuer } = mocks();
    repository.findByEmail.mockResolvedValue(user);
    const useCase = new LoginUseCase(repository, hasher, issuer);

    await expect(
      useCase.execute({ email: 'MARIA@example.com', password: 'SenhaSegura123' }),
    ).resolves.toEqual({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user,
    });
    expect(repository.findByEmail).toHaveBeenCalledWith('maria@example.com');
    expect(hasher.compare).toHaveBeenCalledWith('SenhaSegura123', user.passwordHash);
    expect(issuer.issue).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
    });
  });

  it('rejeita senha incorreta', async () => {
    const { repository, hasher, issuer } = mocks();
    repository.findByEmail.mockResolvedValue(user);
    hasher.compare.mockResolvedValue(false);
    const useCase = new LoginUseCase(repository, hasher, issuer);

    await expect(
      useCase.execute({ email: user.email, password: 'errada123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(issuer.issue).not.toHaveBeenCalled();
  });

  it('rejeita e-mail inexistente comparando com hash fictício', async () => {
    const { repository, hasher, issuer } = mocks();
    const useCase = new LoginUseCase(repository, hasher, issuer);

    await expect(
      useCase.execute({ email: 'ninguem@example.com', password: 'qualquer1' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.compare).toHaveBeenCalledWith(
      'qualquer1',
      expect.stringMatching(/^\$2[ab]\$10\$/u),
    );
    expect(issuer.issue).not.toHaveBeenCalled();
  });
});
