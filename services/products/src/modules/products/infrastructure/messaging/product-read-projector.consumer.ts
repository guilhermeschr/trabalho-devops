import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Product, ProductEvent } from '../../domain/product';
import {
  PRODUCT_READ_REPOSITORY,
  PROCESSED_EVENT_REPOSITORY,
} from '../../application/ports/product.tokens';
import {
  ProcessedEventRepository,
  ProductReadRepository,
} from '../../application/ports/product.repositories';
import { Inject } from '@nestjs/common';

@Injectable()
export class ProductReadProjectorConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProductReadProjectorConsumer.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    @Inject(PRODUCT_READ_REPOSITORY)
    private readonly productReadRepository: ProductReadRepository,
    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEventRepository: ProcessedEventRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'delivery.events',
    );
    const queue = this.configService.get<string>(
      'RABBITMQ_PRODUCTS_QUEUE',
      'products.read.projector',
    );

    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    this.connection = connection;
    this.channel = channel;
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'product.*');

    await channel.consume(queue, async (message) => {
      if (!message) {
        return;
      }

      try {
        const event = this.parseEvent(message.content.toString());
        if (await this.processedEventRepository.hasProcessed(event.eventId)) {
          channel.ack(message);
          return;
        }

        await this.productReadRepository.upsertProjection(event.payload);
        await this.processedEventRepository.markProcessed(event.eventId);
        channel.ack(message);
      } catch (error) {
        this.logger.error(
          'Falha ao projetar evento de Produto',
          error instanceof Error ? error.stack : String(error),
        );
        channel.nack(message, false, true);
      }
    });
  }

  private parseEvent(raw: string): ProductEvent {
    const parsed = JSON.parse(raw) as ProductEvent & {
      occurredAt: string;
      payload: Product & {
        createdAt: string;
        updatedAt: string;
      };
    };

    return {
      ...parsed,
      occurredAt: new Date(parsed.occurredAt),
      payload: {
        ...parsed.payload,
        createdAt: new Date(parsed.payload.createdAt),
        updatedAt: new Date(parsed.payload.updatedAt),
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn(
        'Falha ao fechar o consumidor RabbitMQ: ' + String(error),
      );
    }
  }
}
