import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
} from 'typeorm';

export class CreateUsersTable1720000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
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
            name: 'email',
            type: 'varchar',
            length: '254',
            isUnique: true,
          }),
          new TableColumn({
            name: 'password_hash',
            type: 'varchar',
            length: '100',
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamptz',
          }),
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users', true);
  }
}
