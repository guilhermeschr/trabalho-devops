import { DataSource } from 'typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';
import { CreateUsersTable1720000000000 } from './migrations/1720000000000-create-users-table';

export default new DataSource({
  type: 'postgres',
  host: process.env.AUTH_DB_HOST ?? 'localhost',
  port: Number(process.env.AUTH_DB_PORT ?? 5432),
  database: process.env.AUTH_DB_NAME ?? 'auth',
  username: process.env.AUTH_DB_USER ?? 'auth',
  password: process.env.AUTH_DB_PASSWORD ?? 'auth',
  entities: [UserOrmEntity],
  migrations: [CreateUsersTable1720000000000],
  synchronize: false,
});
