import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryWrite1789689600000,
  InventoryRead1789689600001,
} from './infrastructure/persistence/migrations';
import { StockWriteSqlRepository } from './infrastructure/persistence/stock-write.repository';
import { StockReadSqlRepository } from './infrastructure/persistence/stock-read.repository';
import { OutboxSqlRepository } from './infrastructure/persistence/outbox.repository';
import { StockReadProjectorConsumer } from './infrastructure/messaging/stock-read-projector.consumer';
import { RabbitMqStockEventPublisher } from './infrastructure/messaging/rabbitmq-stock-event.publisher';
import { OutboxPublisherWorker } from './infrastructure/messaging/outbox-publisher.worker';
import {
  STOCK_READ_REPOSITORY,
  STOCK_WRITE_REPOSITORY,
  STOCK_EVENT_PUBLISHER,
  OUTBOX_REPOSITORY,
} from './application/ports/stock.tokens';
import {
  AddStockUseCase,
  GetStockUseCase,
  DebitStockUseCase,
} from './application/use-cases/stock.use-cases';
import {
  InventoryController,
  InternalInventoryController,
} from './presentation/http/inventory.controller';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { InternalTokenGuard } from './infrastructure/auth/internal-token.guard';
const databases = (['WRITE', 'READ'] as const).map((mode) =>
  TypeOrmModule.forRootAsync({
    name: mode === 'WRITE' ? 'inventoryWrite' : 'inventoryRead',
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      type: 'postgres' as const,
      host: config.get<string>(`INVENTORY_${mode}_DB_HOST`, 'localhost'),
      port: Number(config.get<string>(`INVENTORY_${mode}_DB_PORT`, '5432')),
      database: config.get<string>(
        `INVENTORY_${mode}_DB_NAME`,
        `inventory_${mode.toLowerCase()}`,
      ),
      username: config.get<string>(`INVENTORY_${mode}_DB_USER`, 'inventory'),
      password: config.getOrThrow<string>(`INVENTORY_${mode}_DB_PASSWORD`),
      migrations: [
        mode === 'WRITE'
          ? InventoryWrite1789689600000
          : InventoryRead1789689600001,
      ],
      migrationsRun: true,
      synchronize: false,
    }),
  }),
);
@Module({
  imports: [ConfigModule, JwtModule.register({}), ...databases],
  controllers: [InventoryController, InternalInventoryController],
  providers: [
    AddStockUseCase,
    GetStockUseCase,
    DebitStockUseCase,
    JwtAuthGuard,
    InternalTokenGuard,
    StockReadProjectorConsumer,
    OutboxPublisherWorker,
    { provide: STOCK_WRITE_REPOSITORY, useClass: StockWriteSqlRepository },
    { provide: STOCK_READ_REPOSITORY, useClass: StockReadSqlRepository },
    { provide: STOCK_EVENT_PUBLISHER, useClass: RabbitMqStockEventPublisher },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxSqlRepository },
  ],
})
export class InventoryModule {}
