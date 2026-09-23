import { QueryFailedError, Repository } from 'typeorm';
import { EmailAlreadyRegisteredError } from '../../../domain/user';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { TypeOrmUserRepository } from './typeorm-user.repository';

function ormRepository() {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((value: UserOrmEntity) => value),
    insert: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Repository<UserOrmEntity>>;
}

const newUser = {
  name: 'Maria Silva',
  email: 'maria@example.com',
  passwordHash: '$2b$10$hash',
};

describe('TypeOrmUserRepository', () => {
  it('grava usuário com id UUID e data de criação', async () => {
    const orm = ormRepository();
    const repository = new TypeOrmUserRepository(orm);

    const user = await repository.create(newUser);

    expect(user).toEqual(
      expect.objectContaining({
        ...newUser,
        id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        createdAt: expect.any(Date),
      }),
    );
    expect(orm.insert).toHaveBeenCalledWith(expect.objectContaining(newUser));
  });

  it('converte violação de unicidade em e-mail duplicado', async () => {
    const orm = ormRepository();
    orm.insert.mockRejectedValue(
      new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })),
    );
    const repository = new TypeOrmUserRepository(orm);

    await expect(repository.create(newUser)).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('propaga outros erros do banco', async () => {
    const orm = ormRepository();
    const failure = new Error('conexão perdida');
    orm.insert.mockRejectedValue(failure);
    const repository = new TypeOrmUserRepository(orm);

    await expect(repository.create(newUser)).rejects.toBe(failure);
  });

  it('busca usuário por e-mail', async () => {
    const orm = ormRepository();
    const entity = {
      ...newUser,
      id: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
      createdAt: new Date(),
    };
    orm.findOneBy.mockResolvedValueOnce(entity).mockResolvedValueOnce(null);
    const repository = new TypeOrmUserRepository(orm);

    await expect(repository.findByEmail(newUser.email)).resolves.toEqual(entity);
    await expect(repository.findByEmail('outro@example.com')).resolves.toBeNull();
    expect(orm.findOneBy).toHaveBeenCalledWith({ email: newUser.email });
  });
});
