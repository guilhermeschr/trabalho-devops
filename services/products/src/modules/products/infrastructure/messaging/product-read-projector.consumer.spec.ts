jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import * as amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProcessedEventRepository,
  ProductReadRepository,
} from '../../application/ports/product.repositories';
import { ProductReadProjectorConsumer } from './product-read-projector.consumer';

const event = {
  eventId: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
  eventType: 'product.created',
  aggregateId: 'f3a3b2c1-4d5e-6789-abcd-ef0123456789',
  occurredAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  payload: {
    id: 'f3a3b2c1-4d5e-6789-abcd-ef0123456789',
    name: 'Pizza',
    description: null,
    price: 39.9,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

function config(): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue('amqp://rabbit'),
    get: jest.fn((key: string, fallback: string) => {
      if (key === 'RABBITMQ_EXCHANGE') return 'delivery.events';
      if (key === 'RABBITMQ_PRODUCTS_QUEUE') return 'products.read.projector';
      return fallback;
    }),
  } as unknown as ConfigService;
}

function setup() {
  const consume = jest.fn().mockResolvedValue({ consumerTag: 'products' });
  const channel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    consume,
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connection = {
    createChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(undefined),
  };
  (amqp.connect as jest.Mock).mockResolvedValue(connection);
  const readRepository: ProductReadRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    upsertProjection: jest.fn().mockResolvedValue(undefined),
  };
  const processedRepository: ProcessedEventRepository = {
    hasProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue(undefined),
  };
  const consumer = new ProductReadProjectorConsumer(
    config(),
    readRepository,
    processedRepository,
  );

  return {
    consumer,
    channel,
    connection,
    consume,
    readRepository,
    processedRepository,
  };
}

describe('ProductReadProjectorConsumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('projeta evento e marca eventId como processado', async () => {
    const setupResult = setup();
    await setupResult.consumer.onModuleInit();
    const handler = setupResult.consume.mock.calls[0][1] as (
      message: amqp.ConsumeMessage | null,
    ) => Promise<void>;
    const message = {
      content: Buffer.from(JSON.stringify(event)),
    } as amqp.ConsumeMessage;

    await handler(message);

    expect(setupResult.readRepository.upsertProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.payload.id,
        createdAt: new Date(event.payload.createdAt),
      }),
    );
    expect(setupResult.processedRepository.markProcessed).toHaveBeenCalledWith(
      event.eventId,
    );
    expect(setupResult.channel.ack).toHaveBeenCalledWith(message);
  });

  it('confirma sem reprojetar evento duplicado', async () => {
    const setupResult = setup();
    (
      setupResult.processedRepository.hasProcessed as jest.Mock
    ).mockResolvedValue(true);
    await setupResult.consumer.onModuleInit();
    const handler = setupResult.consume.mock.calls[0][1] as (
      message: amqp.ConsumeMessage | null,
    ) => Promise<void>;
    const message = {
      content: Buffer.from(JSON.stringify(event)),
    } as amqp.ConsumeMessage;

    await handler(message);

    expect(setupResult.readRepository.upsertProjection).not.toHaveBeenCalled();
    expect(setupResult.channel.ack).toHaveBeenCalledWith(message);
  });

  it('recoloca mensagem quando a projeção falha', async () => {
    const setupResult = setup();
    (
      setupResult.readRepository.upsertProjection as jest.Mock
    ).mockRejectedValue(new Error('banco indisponível'));
    await setupResult.consumer.onModuleInit();
    const handler = setupResult.consume.mock.calls[0][1] as (
      message: amqp.ConsumeMessage | null,
    ) => Promise<void>;
    const message = {
      content: Buffer.from(JSON.stringify(event)),
    } as amqp.ConsumeMessage;

    await handler(message);

    expect(setupResult.channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('ignora callback sem mensagem e fecha recursos', async () => {
    const setupResult = setup();
    await setupResult.consumer.onModuleInit();
    const handler = setupResult.consume.mock.calls[0][1] as (
      message: amqp.ConsumeMessage | null,
    ) => Promise<void>;

    await handler(null);
    await setupResult.consumer.onModuleDestroy();

    expect(setupResult.connection.close).toHaveBeenCalled();
    expect(setupResult.channel.close).toHaveBeenCalled();
  });
});
