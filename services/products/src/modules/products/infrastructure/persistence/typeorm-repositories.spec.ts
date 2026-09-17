import { DataSource } from 'typeorm';
import { ProductNotFoundError } from '../../domain/product';
import { OutboxEventOrmEntity } from './write/entities/outbox-event.orm-entity';
import { ProductWriteOrmEntity } from './write/entities/product-write.orm-entity';
import { TypeOrmOutboxRepository } from './write/repositories/typeorm-outbox.repository';
import { TypeOrmProductWriteRepository } from './write/repositories/typeorm-product-write.repository';
import { ProductReadOrmEntity } from './read/entities/product-read.orm-entity';
import { ProcessedEventOrmEntity } from './read/entities/processed-event.orm-entity';
import { TypeOrmProcessedEventRepository } from './read/repositories/typeorm-processed-event.repository';
import { TypeOrmProductReadRepository } from './read/repositories/typeorm-product-read.repository';

const productId = 'f3a3b2c1-4d5e-6789-abcd-ef0123456789';
const productInput = {
  name: 'Pizza',
  description: null,
  price: 39.9,
  active: true,
};

function writeDataSource(manager: {
  save: jest.Mock;
  findOne: jest.Mock;
}): DataSource {
  return {
    transaction: jest.fn(async (callback: (value: typeof manager) => unknown) =>
      callback(manager),
    ),
  } as unknown as DataSource;
}

describe('TypeOrmProductWriteRepository', () => {
  it('persiste produto e Outbox na mesma transação', async () => {
    const manager = {
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };
    const repository = new TypeOrmProductWriteRepository(
      writeDataSource(manager),
    );

    const product = await repository.create(productInput);

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save.mock.calls[0][0]).toBe(ProductWriteOrmEntity);
    expect(manager.save.mock.calls[1][0]).toBe(OutboxEventOrmEntity);
    expect(manager.save.mock.calls[1][1]).toMatchObject({
      eventType: 'product.created',
      aggregateId: product.id,
      payload: expect.objectContaining({
        id: product.id,
        createdAt: product.createdAt.toISOString(),
      }),
    });
  });

  it('atualiza produto e registra evento de alteração', async () => {
    const entity = Object.assign(new ProductWriteOrmEntity(), {
      id: productId,
      name: 'Pizza antiga',
      description: null,
      price: 30,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const manager = {
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(entity),
    };
    const repository = new TypeOrmProductWriteRepository(
      writeDataSource(manager),
    );

    const product = await repository.update(productId, {
      name: 'Pizza nova',
      description: 'Descrição',
      price: 45,
      active: false,
    });

    expect(product.name).toBe('Pizza nova');
    expect(manager.save.mock.calls[1][1]).toMatchObject({
      eventType: 'product.updated',
      aggregateId: productId,
    });
  });

  it('rejeita atualização de produto inexistente', async () => {
    const manager = {
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const repository = new TypeOrmProductWriteRepository(
      writeDataSource(manager),
    );

    await expect(repository.update(productId, productInput)).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
});

function readDataSource(repository: {
  find?: jest.Mock;
  findOne?: jest.Mock;
  upsert?: jest.Mock;
  save?: jest.Mock;
}): DataSource {
  return {
    getRepository: jest.fn().mockReturnValue(repository),
  } as unknown as DataSource;
}

describe('TypeOrmProductReadRepository', () => {
  it('consulta todos os produtos na projeção de leitura', async () => {
    const entities = [
      Object.assign(new ProductReadOrmEntity(), {
        id: productId,
        name: 'Pizza',
        description: null,
        price: 39.9,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      Object.assign(new ProductReadOrmEntity(), {
        id: 'c4d3e2f1-9876-5432-10ab-cdef98765432',
        name: 'Refrigerante',
        description: null,
        price: 8.5,
        active: false,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ];
    const readRepository = {
      find: jest.fn().mockResolvedValue(entities),
    };
    const repository = new TypeOrmProductReadRepository(
      readDataSource(readRepository),
    );

    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: productId, price: 39.9 }),
      expect.objectContaining({
        id: 'c4d3e2f1-9876-5432-10ab-cdef98765432',
        price: 8.5,
        active: false,
      }),
    ]);
    expect(readRepository.find).toHaveBeenCalledWith();
  });

  it('retorna lista vazia quando não há produtos projetados', async () => {
    const readRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const repository = new TypeOrmProductReadRepository(
      readDataSource(readRepository),
    );

    await expect(repository.findAll()).resolves.toEqual([]);
  });

  it('consulta somente a projeção de leitura', async () => {
    const entity = Object.assign(new ProductReadOrmEntity(), {
      id: productId,
      name: 'Pizza',
      description: null,
      price: 39.9,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const readRepository = {
      findOne: jest.fn().mockResolvedValue(entity),
      upsert: jest.fn(),
    };
    const repository = new TypeOrmProductReadRepository(
      readDataSource(readRepository),
    );

    await expect(repository.findById(productId)).resolves.toMatchObject({
      id: productId,
      price: 39.9,
    });
    expect(readRepository.findOne).toHaveBeenCalledWith({
      where: { id: productId },
    });
  });

  it('retorna nulo e atualiza projeção por id', async () => {
    const readRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TypeOrmProductReadRepository(
      readDataSource(readRepository),
    );
    const product = {
      id: productId,
      name: 'Pizza',
      description: null,
      price: 39.9,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(repository.findById(productId)).resolves.toBeNull();
    await repository.upsertProjection(product);
    expect(readRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: productId }),
      ['id'],
    );
  });
});

describe('TypeOrmProcessedEventRepository', () => {
  it('consulta e grava eventId processado', async () => {
    const readRepository = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({}),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TypeOrmProcessedEventRepository(
      readDataSource(readRepository),
    );

    await expect(repository.hasProcessed('event-1')).resolves.toBe(false);
    await expect(repository.hasProcessed('event-1')).resolves.toBe(true);
    await repository.markProcessed('event-1');
    expect(readRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });
});

describe('TypeOrmOutboxRepository', () => {
  it('converte eventos pendentes para o contrato da aplicação', async () => {
    const event = Object.assign(new OutboxEventOrmEntity(), {
      eventId: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
      eventType: 'product.created',
      aggregateId: productId,
      payload: {
        id: productId,
        name: 'Pizza',
        description: null,
        price: 39.9,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      version: 1,
      attempts: 0,
    });
    const writeRepository = {
      find: jest.fn().mockResolvedValue([event]),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TypeOrmOutboxRepository(
      readDataSource(writeRepository),
    );

    const pending = await repository.findPending(10);

    expect(pending[0]).toMatchObject({
      eventId: event.eventId,
      payload: expect.objectContaining({
        createdAt: new Date(event.payload.createdAt),
        updatedAt: new Date(event.payload.updatedAt),
      }),
    });
  });

  it('marca publicação e registra falha somente quando o evento existe', async () => {
    const event = Object.assign(new OutboxEventOrmEntity(), {
      eventId: 'event-1',
      attempts: 0,
      lastError: null,
    });
    const writeRepository = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(event),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const repository = new TypeOrmOutboxRepository(
      readDataSource(writeRepository),
    );

    await repository.markPublished('event-1');
    await repository.markFailed('missing', 'não encontrado');
    await repository.markFailed('event-1', 'broker indisponível');

    expect(writeRepository.update).toHaveBeenCalledWith(
      { eventId: 'event-1' },
      expect.objectContaining({ publishedAt: expect.any(Date) }),
    );
    expect(event.attempts).toBe(1);
    expect(event.lastError).toBe('broker indisponível');
    expect(writeRepository.save).toHaveBeenCalledWith(event);
  });
});
