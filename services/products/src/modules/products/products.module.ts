import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductReadOrmEntity } from './infrastructure/persistence/read/entities/product-read.orm-entity';
import { ProcessedEventOrmEntity } from './infrastructure/persistence/read/entities/processed-event.orm-entity';
import { CreateProductsReadTables1710000000001 } from './infrastructure/persistence/read/migrations/1710000000001-create-products-read-tables';
import { TypeOrmProcessedEventRepository } from './infrastructure/persistence/read/repositories/typeorm-processed-event.repository';
import { TypeOrmProductReadRepository } from './infrastructure/persistence/read/repositories/typeorm-product-read.repository';
import { ProductReadProjectorConsumer } from './infrastructure/messaging/product-read-projector.consumer';
import { OutboxPublisherWorker } from './infrastructure/messaging/outbox-publisher.worker';
import { RabbitMqProductEventPublisher } from './infrastructure/messaging/rabbitmq-product-event.publisher';
import { OutboxEventOrmEntity } from './infrastructure/persistence/write/entities/outbox-event.orm-entity';
import { ProductWriteOrmEntity } from './infrastructure/persistence/write/entities/product-write.orm-entity';
import { CreateProductsWriteTables1710000000000 } from './infrastructure/persistence/write/migrations/1710000000000-create-products-write-tables';
import { TypeOrmOutboxRepository } from './infrastructure/persistence/write/repositories/typeorm-outbox.repository';
import { TypeOrmProductWriteRepository } from './infrastructure/persistence/write/repositories/typeorm-product-write.repository';
import {
  PRODUCT_EVENT_PUBLISHER,
  PRODUCT_READ_REPOSITORY,
  PRODUCT_WRITE_REPOSITORY,
  OUTBOX_REPOSITORY,
  PROCESSED_EVENT_REPOSITORY,
} from './application/ports/product.tokens';
import { CreateProductUseCase } from './application/use-cases/create-product.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { InternalTokenGuard } from './infrastructure/auth/internal-token.guard';
import { InternalProductsController } from './presentation/http/internal-products.controller';
import { ProductsController } from './presentation/http/products.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'change-me-in-development',
        ),
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'productsWrite',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'productsWrite',
        type: 'postgres' as const,
        host: configService.get<string>(
          'PRODUCTS_WRITE_DB_HOST',
          'localhost',
        ),
        port: Number(configService.get<string>('PRODUCTS_WRITE_DB_PORT', '5432')),
        database: configService.get<string>(
          'PRODUCTS_WRITE_DB_NAME',
          'products_write',
        ),
        username: configService.get<string>(
          'PRODUCTS_WRITE_DB_USER',
          'products',
        ),
        password: configService.get<string>(
          'PRODUCTS_WRITE_DB_PASSWORD',
          'products',
        ),
        entities: [ProductWriteOrmEntity, OutboxEventOrmEntity],
        migrations: [CreateProductsWriteTables1710000000000],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'productsRead',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'productsRead',
        type: 'postgres' as const,
        host: configService.get<string>(
          'PRODUCTS_READ_DB_HOST',
          'localhost',
        ),
        port: Number(configService.get<string>('PRODUCTS_READ_DB_PORT', '5432')),
        database: configService.get<string>(
          'PRODUCTS_READ_DB_NAME',
          'products_read',
        ),
        username: configService.get<string>(
          'PRODUCTS_READ_DB_USER',
          'products',
        ),
        password: configService.get<string>(
          'PRODUCTS_READ_DB_PASSWORD',
          'products',
        ),
        entities: [ProductReadOrmEntity, ProcessedEventOrmEntity],
        migrations: [CreateProductsReadTables1710000000001],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature(
      [ProductWriteOrmEntity, OutboxEventOrmEntity],
      'productsWrite',
    ),
    TypeOrmModule.forFeature(
      [ProductReadOrmEntity, ProcessedEventOrmEntity],
      'productsRead',
    ),
  ],
  controllers: [ProductsController, InternalProductsController],
  providers: [
    CreateProductUseCase,
    UpdateProductUseCase,
    GetProductUseCase,
    ListProductsUseCase,
    JwtAuthGuard,
    InternalTokenGuard,
    ProductReadProjectorConsumer,
    OutboxPublisherWorker,
    {
      provide: PRODUCT_WRITE_REPOSITORY,
      useClass: TypeOrmProductWriteRepository,
    },
    {
      provide: PRODUCT_READ_REPOSITORY,
      useClass: TypeOrmProductReadRepository,
    },
    {
      provide: PROCESSED_EVENT_REPOSITORY,
      useClass: TypeOrmProcessedEventRepository,
    },
    {
      provide: OUTBOX_REPOSITORY,
      useClass: TypeOrmOutboxRepository,
    },
    {
      provide: PRODUCT_EVENT_PUBLISHER,
      useClass: RabbitMqProductEventPublisher,
    },
  ],
})
export class ProductsModule {}
