import { Logger } from '@nestjs/common';
import {
  OutboxEventRecord,
  OutboxRepository,
  ProductEventPublisher,
} from '../../application/ports/product.repositories';
import { OutboxPublisherWorker } from './outbox-publisher.worker';

const record: OutboxEventRecord = {
  eventId: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
  eventType: 'product.created',
  aggregateId: 'f3a3b2c1-4d5e-6789-abcd-ef0123456789',
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
  attempts: 0,
  payload: {
    id: 'f3a3b2c1-4d5e-6789-abcd-ef0123456789',
    name: 'Pizza',
    description: null,
    price: 39.9,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

describe('OutboxPublisherWorker', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publica eventos pendentes e marca o evento como publicado', async () => {
    const outbox: OutboxRepository = {
      findPending: jest.fn().mockResolvedValue([record]),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const publisher: ProductEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const worker = new OutboxPublisherWorker(outbox, publisher);

    await worker.publishPending();

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: record.eventId,
        eventType: record.eventType,
      }),
    );
    expect(outbox.markPublished).toHaveBeenCalledWith(record.eventId);
  });

  it('mantém evento na Outbox e registra erro para retry', async () => {
    const outbox: OutboxRepository = {
      findPending: jest.fn().mockResolvedValue([record]),
      markPublished: jest.fn(),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const publisher: ProductEventPublisher = {
      publish: jest.fn().mockRejectedValue(new Error('RabbitMQ indisponível')),
    };
    const worker = new OutboxPublisherWorker(outbox, publisher);

    await worker.publishPending();

    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      record.eventId,
      'RabbitMQ indisponível',
    );
  });

  it('não executa duas publicações simultâneas', async () => {
    let release!: () => void;
    const firstRead = new Promise<OutboxEventRecord[]>((resolve) => {
      release = () => resolve([]);
    });
    const outbox: OutboxRepository = {
      findPending: jest.fn().mockReturnValueOnce(firstRead).mockResolvedValue([]),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    const publisher: ProductEventPublisher = {
      publish: jest.fn(),
    };
    const worker = new OutboxPublisherWorker(outbox, publisher);
    const firstRun = worker.publishPending();
    await worker.publishPending();

    expect(outbox.findPending).toHaveBeenCalledTimes(1);
    release();
    await firstRun;
  });
});
