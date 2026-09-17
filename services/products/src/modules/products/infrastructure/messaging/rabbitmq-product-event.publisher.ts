import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import {
  ProductEvent,
} from '../../domain/product';
import { ProductEventPublisher } from '../../application/ports/product.repositories';

@Injectable()
export class RabbitMqProductEventPublisher
  implements ProductEventPublisher, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqProductEventPublisher.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.ConfirmChannel;

  constructor(private readonly configService: ConfigService) {}

  private async getChannel(): Promise<amqp.ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    const connection = await amqp.connect(url);
    const channel = await connection.createConfirmChannel();
    this.connection = connection;
    this.channel = channel;

    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'delivery.events',
    );
    await channel.assertExchange(exchange, 'topic', { durable: true });
    return channel;
  }

  async publish(event: ProductEvent): Promise<void> {
    const channel = await this.getChannel();
    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'delivery.events',
    );

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        event.eventType,
        Buffer.from(
          JSON.stringify({
            ...event,
            occurredAt: event.occurredAt.toISOString(),
            payload: {
              ...event.payload,
              createdAt: event.payload.createdAt.toISOString(),
              updatedAt: event.payload.updatedAt.toISOString(),
            },
          }),
        ),
        {
          persistent: true,
          contentType: 'application/json',
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn(
        'Falha ao fechar a conexão RabbitMQ: ' + String(error),
      );
    }
  }
}
