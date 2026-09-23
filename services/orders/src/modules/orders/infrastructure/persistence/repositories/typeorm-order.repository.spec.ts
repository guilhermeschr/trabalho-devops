import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../../domain/order';
import {
  numericTransformer,
  OrderOrmEntity,
} from '../entities/order.orm-entity';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

const order: Order = {
  id: 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc',
  userId: '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01',
  productId: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
  quantity: 2,
  unitPrice: 34.9,
  total: 69.8,
  status: OrderStatus.CREATED,
  createdAt: new Date('2026-09-16T15:20:00.000Z'),
  updatedAt: new Date('2026-09-16T15:20:00.000Z'),
};

function repositoryMock() {
  return {
    create: jest.fn((value: Partial<OrderOrmEntity>) => ({ ...value })),
    insert: jest.fn().mockResolvedValue({}),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
}

describe('TypeOrmOrderRepository', () => {
  it('insere o pedido', async () => {
    const orm = repositoryMock();
    const repository = new TypeOrmOrderRepository(
      orm as unknown as Repository<OrderOrmEntity>,
    );

    await expect(repository.create(order)).resolves.toBe(order);
    expect(orm.insert).toHaveBeenCalledWith(order);
  });

  it('busca por id e converte para o domínio', async () => {
    const orm = repositoryMock();
    orm.findOneBy.mockResolvedValueOnce({ ...order }).mockResolvedValueOnce(null);
    const repository = new TypeOrmOrderRepository(
      orm as unknown as Repository<OrderOrmEntity>,
    );

    await expect(repository.findById(order.id)).resolves.toEqual(order);
    await expect(repository.findById(order.id)).resolves.toBeNull();
    expect(orm.findOneBy).toHaveBeenCalledWith({ id: order.id });
  });

  it('conclui somente pedidos CREATED com UPDATE condicional', async () => {
    const orm = repositoryMock();
    const completedAt = new Date('2026-09-16T15:25:00.000Z');
    orm.update.mockResolvedValue({ affected: 1 });
    orm.findOneBy.mockResolvedValue({
      ...order,
      status: OrderStatus.COMPLETED,
      updatedAt: completedAt,
    });
    const repository = new TypeOrmOrderRepository(
      orm as unknown as Repository<OrderOrmEntity>,
    );

    await expect(repository.complete(order.id, completedAt)).resolves.toEqual(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
    );
    expect(orm.update).toHaveBeenCalledWith(
      { id: order.id, status: OrderStatus.CREATED },
      { status: OrderStatus.COMPLETED, updatedAt: completedAt },
    );
  });

  it('retorna null quando nenhuma linha foi alterada', async () => {
    const orm = repositoryMock();
    orm.update.mockResolvedValue({ affected: 0 });
    const repository = new TypeOrmOrderRepository(
      orm as unknown as Repository<OrderOrmEntity>,
    );

    await expect(repository.complete(order.id, new Date())).resolves.toBeNull();
    expect(orm.findOneBy).not.toHaveBeenCalled();
  });

  it('converte numeric do PostgreSQL em number', () => {
    expect(numericTransformer.from('69.80')).toBe(69.8);
    expect(numericTransformer.from(null)).toBeNull();
    expect(numericTransformer.to(34.9)).toBe(34.9);
  });
});
