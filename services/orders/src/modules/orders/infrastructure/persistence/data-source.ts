import { DataSource } from 'typeorm';
import { OrderOrmEntity } from './entities/order.orm-entity';
import { CreateOrdersTable1730000000000 } from './migrations/1730000000000-create-orders-table';

export default new DataSource({
  type: 'postgres',
  host: process.env.ORDERS_DB_HOST ?? 'localhost',
  port: Number(process.env.ORDERS_DB_PORT ?? 5432),
  database: process.env.ORDERS_DB_NAME ?? 'orders',
  username: process.env.ORDERS_DB_USER ?? 'orders',
  password: process.env.ORDERS_DB_PASSWORD ?? 'orders',
  entities: [OrderOrmEntity],
  migrations: [CreateOrdersTable1730000000000],
  synchronize: false,
});
