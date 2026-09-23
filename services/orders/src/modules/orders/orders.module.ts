import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  INVENTORY_CLIENT,
  ORDER_REPOSITORY,
  PRODUCTS_CLIENT,
} from './application/ports/orders.tokens';
import { CompleteOrderUseCase } from './application/use-cases/complete-order.use-case';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { InventoryHttpClient } from './infrastructure/http/inventory-http.client';
import { ProductsHttpClient } from './infrastructure/http/products-http.client';
import { OrderOrmEntity } from './infrastructure/persistence/entities/order.orm-entity';
import { CreateOrdersTable1730000000000 } from './infrastructure/persistence/migrations/1730000000000-create-orders-table';
import {
  ORDERS_CONNECTION,
  TypeOrmOrderRepository,
} from './infrastructure/persistence/repositories/typeorm-order.repository';
import { OrdersController } from './presentation/http/orders.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forRootAsync({
      name: ORDERS_CONNECTION,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: ORDERS_CONNECTION,
        type: 'postgres' as const,
        host: configService.get<string>('ORDERS_DB_HOST', 'localhost'),
        port: Number(configService.get<string>('ORDERS_DB_PORT', '5432')),
        database: configService.get<string>('ORDERS_DB_NAME', 'orders'),
        username: configService.get<string>('ORDERS_DB_USER', 'orders'),
        password: configService.get<string>('ORDERS_DB_PASSWORD', 'orders'),
        entities: [OrderOrmEntity],
        migrations: [CreateOrdersTable1730000000000],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([OrderOrmEntity], ORDERS_CONNECTION),
  ],
  controllers: [OrdersController],
  providers: [
    CreateOrderUseCase,
    GetOrderUseCase,
    CompleteOrderUseCase,
    JwtAuthGuard,
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
    { provide: PRODUCTS_CLIENT, useClass: ProductsHttpClient },
    { provide: INVENTORY_CLIENT, useClass: InventoryHttpClient },
  ],
})
export class OrdersModule {}
