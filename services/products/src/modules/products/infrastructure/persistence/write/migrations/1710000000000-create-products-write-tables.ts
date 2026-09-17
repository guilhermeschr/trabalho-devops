import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateProductsWriteTables1710000000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          }),
          new TableColumn({
            name: 'name',
            type: 'varchar',
            length: '120',
          }),
          new TableColumn({
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          }),
          new TableColumn({
            name: 'price',
            type: 'numeric',
            precision: 10,
            scale: 2,
          }),
          new TableColumn({
            name: 'active',
            type: 'boolean',
            default: true,
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamptz',
          }),
          new TableColumn({
            name: 'updated_at',
            type: 'timestamptz',
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'outbox_events',
        columns: [
          new TableColumn({
            name: 'event_id',
            type: 'uuid',
            isPrimary: true,
          }),
          new TableColumn({
            name: 'event_type',
            type: 'varchar',
            length: '80',
          }),
          new TableColumn({
            name: 'aggregate_id',
            type: 'uuid',
          }),
          new TableColumn({
            name: 'payload',
            type: 'jsonb',
          }),
          new TableColumn({
            name: 'occurred_at',
            type: 'timestamptz',
          }),
          new TableColumn({
            name: 'version',
            type: 'integer',
            default: 1,
          }),
          new TableColumn({
            name: 'published_at',
            type: 'timestamptz',
            isNullable: true,
          }),
          new TableColumn({
            name: 'attempts',
            type: 'integer',
            default: 0,
          }),
          new TableColumn({
            name: 'last_error',
            type: 'text',
            isNullable: true,
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'outbox_events',
      new TableIndex({
        name: 'IDX_OUTBOX_PENDING_EVENTS',
        columnNames: ['published_at', 'occurred_at'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('outbox_events');
    await queryRunner.dropTable('products');
  }
}
