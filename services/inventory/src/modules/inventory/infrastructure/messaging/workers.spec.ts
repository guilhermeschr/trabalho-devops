jest.mock('amqplib', () => ({ connect: jest.fn() }));
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { StockReadProjectorConsumer } from './stock-read-projector.consumer';
import { OutboxPublisherWorker } from './outbox-publisher.worker';
const event: any = {
  eventId: 'e',
  eventType: 'inventory.stock_added',
  aggregateId: 'p',
  version: 1,
  occurredAt: new Date(),
  payload: { productId: 'p', availableQuantity: 20, updatedAt: new Date() },
};
describe('Workers de estoque', () => {
  it('confirma publicações e mantém falhas pendentes', async () => {
    const repository = {
      findPending: jest.fn().mockResolvedValue([event]),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const worker = new OutboxPublisherWorker(repository, publisher);
    await worker.publishPending();
    expect(repository.markPublished).toHaveBeenCalledWith('e');
    publisher.publish.mockRejectedValue(new Error('offline'));
    await worker.publishPending();
    expect(repository.markFailed).toHaveBeenCalledWith('e', 'offline');
  });
  it('não sobrepõe ciclos e libera o worker após falha', async () => {
    let release!: (value: any) => void;
    const repository = {
      findPending: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      ),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    const worker = new OutboxPublisherWorker(repository, {
      publish: jest.fn(),
    });
    const first = worker.publishPending();
    await worker.publishPending();
    expect(repository.findPending).toHaveBeenCalledTimes(1);
    release([]);
    await first;
    repository.findPending.mockRejectedValueOnce(new Error('db'));
    await expect(worker.publishPending()).rejects.toThrow('db');
    repository.findPending.mockResolvedValue([]);
    await worker.publishPending();
    expect(repository.findPending).toHaveBeenCalledTimes(3);
  });
  it('ack somente após commit, reenvia falhas e rejeita mensagens inválidas', async () => {
    let consume!: (message: any) => Promise<void>;
    const channel = {
      on: jest.fn(),
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      prefetch: jest.fn(),
      consume: jest.fn((_q, callback) => {
        consume = callback;
      }),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
    };
    const connection = {
      on: jest.fn(),
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    const config = {
      getOrThrow: () => 'amqp://test',
      get: (_key: string, fallback: string) => fallback,
    } as unknown as ConfigService;
    const repository = { findById: jest.fn(), project: jest.fn() };
    const worker = new StockReadProjectorConsumer(config, repository);
    await worker.onModuleInit();
    const message = { content: Buffer.from(JSON.stringify(event)) };
    await consume(message);
    expect(repository.project).toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    repository.project.mockRejectedValueOnce(new Error('db'));
    await consume(message);
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    const invalid = { content: Buffer.from('{}') };
    await consume(invalid);
    expect(channel.nack).toHaveBeenCalledWith(invalid, false, false);
    await consume(null);
    await worker.onModuleDestroy();
    expect(connection.close).toHaveBeenCalled();
  });
});
