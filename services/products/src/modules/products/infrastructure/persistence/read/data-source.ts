import { DataSource } from 'typeorm';
import { ProductReadOrmEntity } from './entities/product-read.orm-entity';
import { ProcessedEventOrmEntity } from './entities/processed-event.orm-entity';
import { CreateProductsReadTables1710000000001 } from './migrations/1710000000001-create-products-read-tables';

export default new DataSource({
  type: 'postgres',
  host: process.env.PRODUCTS_READ_DB_HOST ?? 'localhost',
  port: Number(process.env.PRODUCTS_READ_DB_PORT ?? 5432),
  database: process.env.PRODUCTS_READ_DB_NAME ?? 'products_read',
  username: process.env.PRODUCTS_READ_DB_USER ?? 'products',
  password: process.env.PRODUCTS_READ_DB_PASSWORD ?? 'products',
  entities: [ProductReadOrmEntity, ProcessedEventOrmEntity],
  migrations: [CreateProductsReadTables1710000000001],
  synchronize: false,
});
