import { DataSource } from 'typeorm';
import { OutboxEventOrmEntity } from './entities/outbox-event.orm-entity';
import { ProductWriteOrmEntity } from './entities/product-write.orm-entity';
import { CreateProductsWriteTables1710000000000 } from './migrations/1710000000000-create-products-write-tables';

export default new DataSource({
  type: 'postgres',
  host: process.env.PRODUCTS_WRITE_DB_HOST ?? 'localhost',
  port: Number(process.env.PRODUCTS_WRITE_DB_PORT ?? 5432),
  database: process.env.PRODUCTS_WRITE_DB_NAME ?? 'products_write',
  username: process.env.PRODUCTS_WRITE_DB_USER ?? 'products',
  password: process.env.PRODUCTS_WRITE_DB_PASSWORD ?? 'products',
  entities: [ProductWriteOrmEntity, OutboxEventOrmEntity],
  migrations: [CreateProductsWriteTables1710000000000],
  synchronize: false,
});
