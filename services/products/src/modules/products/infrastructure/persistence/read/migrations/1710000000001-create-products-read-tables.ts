import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CreateProductsReadTables1710000000001
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'products_projection',
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
        name: 'processed_events',
        columns: [
          new TableColumn({
            name: 'event_id',
            type: 'uuid',
            isPrimary: true,
          }),
          new TableColumn({
            name: 'processed_at',
            type: 'timestamptz',
          }),
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('processed_events');
    await queryRunner.dropTable('products_projection');
  }
}
