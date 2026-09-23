import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateOrdersTable1730000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          new TableColumn({ name: 'id', type: 'uuid', isPrimary: true }),
          new TableColumn({ name: 'user_id', type: 'uuid' }),
          new TableColumn({ name: 'product_id', type: 'uuid' }),
          new TableColumn({ name: 'quantity', type: 'integer' }),
          new TableColumn({
            name: 'unit_price',
            type: 'numeric',
            precision: 12,
            scale: 2,
          }),
          new TableColumn({
            name: 'total',
            type: 'numeric',
            precision: 20,
            scale: 2,
          }),
          new TableColumn({ name: 'status', type: 'varchar', length: '20' }),
          new TableColumn({ name: 'created_at', type: 'timestamptz' }),
          new TableColumn({ name: 'updated_at', type: 'timestamptz' }),
        ],
        checks: [
          { name: 'chk_orders_quantity', expression: 'quantity > 0' },
          {
            name: 'chk_orders_status',
            expression: "status IN ('CREATED', 'COMPLETED')",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'orders',
      new TableIndex({ name: 'idx_orders_user_id', columnNames: ['user_id'] }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders', true);
  }
}
