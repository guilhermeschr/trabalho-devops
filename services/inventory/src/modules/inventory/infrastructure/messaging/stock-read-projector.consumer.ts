import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { STOCK_READ_REPOSITORY } from '../../application/ports/stock.tokens';
import { StockReadRepository } from '../../application/ports/stock.repositories';
import { StockEvent } from '../../domain/stock';
@Injectable()
export class StockReadProjectorConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(StockReadProjectorConsumer.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private stopping = false;
  private retry?: ReturnType<typeof setTimeout>;
  private scheduleReconnect() {
    if (this.stopping || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      void this.onModuleInit();
    }, 1000);
    this.retry.unref();
  }
  constructor(
    private readonly config: ConfigService,
    @Inject(STOCK_READ_REPOSITORY)
    private readonly repository: StockReadRepository,
  ) {}
  async onModuleInit() {
    try {
      await this.connect();
    } catch {
      this.logger.warn('RabbitMQ indisponível; aguardando reconexão');
      this.scheduleReconnect();
    }
  }
  private async connect() {
    this.connection = await amqp.connect(
      this.config.getOrThrow<string>('RABBITMQ_URL'),
    );
    const connection = this.connection;
    connection.on('error', () =>
      this.logger.warn('Conexão RabbitMQ indisponível'),
    );
    connection.on('close', () => this.scheduleReconnect());
    const channel = await connection.createChannel();
    channel.on('error', () => this.logger.warn('Canal RabbitMQ indisponível'));
    channel.on('close', () => {
      if (!this.stopping) {
        void connection.close().catch(() => {});
        this.scheduleReconnect();
      }
    });
    this.channel = channel;
    const exchange = this.config.get<string>(
      'RABBITMQ_EXCHANGE',
      'delivery.events',
    );
    const queue = this.config.get<string>(
      'RABBITMQ_INVENTORY_QUEUE',
      'inventory.read.projector',
    );
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'inventory.*');
    await channel.prefetch(1);
    await channel.consume(queue, async (message) => {
      if (!message) return;
      let event: StockEvent;
      try {
        event = JSON.parse(message.content.toString());
        if (
          !['inventory.stock_added', 'inventory.stock_debited'].includes(
            event.eventType,
          ) ||
          !event.eventId ||
          event.aggregateId !== event.payload?.productId ||
          !Number.isInteger(event.version) ||
          event.version < 1 ||
          !Number.isInteger(event.payload.availableQuantity) ||
          event.payload.availableQuantity < 0
        )
          throw new Error('Evento inválido');
        event.payload.updatedAt = new Date(event.payload.updatedAt);
        if (!Number.isFinite(event.payload.updatedAt.getTime()))
          throw new Error('Data inválida');
      } catch {
        this.logger.warn('Evento inválido rejeitado');
        channel.nack(message, false, false);
        return;
      }
      try {
        await this.repository.project(event);
        channel.ack(message);
      } catch {
        this.logger.warn('Falha ao projetar estoque; evento será reprocessado');
        channel.nack(message, false, true);
      }
    });
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.retry) clearTimeout(this.retry);
    await this.channel?.close();
    await this.connection?.close();
  }
}
