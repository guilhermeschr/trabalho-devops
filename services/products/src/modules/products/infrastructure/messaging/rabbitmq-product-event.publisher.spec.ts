jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { ProductEvent } from '../../domain/product';
import { RabbitMqProductEventPublisher } from './rabbitmq-product-event.publisher';

const event: ProductEvent = {
  eventId: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
  eventType: 'product.created',
  aggregateId: 'f3a3b2c1-4d5e-6789-abcd-ef0123456789',
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
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

function config(): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue('amqp://rabbit'),
    get: jest.fn().mockReturnValue('delivery.events'),
  } as unknown as ConfigService;
}

describe('RabbitMqProductEventPublisher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publica evento persistente na exchange configurada', async () => {
    const channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(
        (
          _exchange: string,
          _routingKey: string,
          _content: Buffer,
          _options: unknown,
          callback: (error?: Error) => void,
        ) => callback(),
      ),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    const publisher = new RabbitMqProductEventPublisher(config());

    await publisher.publish(event);

    expect(channel.assertExchange).toHaveBeenCalledWith(
      'delivery.events',
      'topic',
      { durable: true },
    );
    expect(channel.publish).toHaveBeenCalledWith(
      'delivery.events',
      'product.created',
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        contentType: 'application/json',
      }),
      expect.any(Function),
    );
    const body = JSON.parse(
      (channel.publish as jest.Mock).mock.calls[0][2].toString(),
    ) as ProductEvent & { occurredAt: string };
    expect(body.occurredAt).toBe('2026-01-01T00:00:00.000Z');
    await publisher.onModuleDestroy();
    expect(connection.close).toHaveBeenCalled();
  });

  it('propaga erro de confirmação do RabbitMQ', async () => {
    const channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(
        (
          _exchange: string,
          _routingKey: string,
          _content: Buffer,
          _options: unknown,
          callback: (error?: Error) => void,
        ) => callback(new Error('confirmação rejeitada')),
      ),
    };
    const connection = {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    const publisher = new RabbitMqProductEventPublisher(config());

    await expect(publisher.publish(event)).rejects.toThrow(
      'confirmação rejeitada',
    );
  });
});
