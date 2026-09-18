import { MigrationInterface, QueryRunner } from 'typeorm';
export class InventoryWrite1789689600000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE stock (product_id uuid PRIMARY KEY, available_quantity integer NOT NULL CHECK (available_quantity >= 0), version integer NOT NULL, updated_at timestamptz NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE stock_movements (id uuid PRIMARY KEY, order_id uuid UNIQUE, product_id uuid NOT NULL REFERENCES stock(product_id), quantity integer NOT NULL CHECK (quantity > 0), kind varchar(10) NOT NULL CHECK (kind IN ('add','debit')), remaining_quantity integer NOT NULL, created_at timestamptz NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE outbox_events (event_id uuid PRIMARY KEY, event_type varchar(80) NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL, version integer NOT NULL, published_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text)`,
    );
    await q.query(
      `CREATE INDEX inventory_outbox_pending ON outbox_events (occurred_at) WHERE published_at IS NULL`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE outbox_events');
    await q.query('DROP TABLE stock_movements');
    await q.query('DROP TABLE stock');
  }
}
export class InventoryRead1789689600001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE stock_projection (product_id uuid PRIMARY KEY, available_quantity integer NOT NULL CHECK (available_quantity >= 0), version integer NOT NULL, updated_at timestamptz NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE processed_events (event_id uuid PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now())`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE processed_events');
    await q.query('DROP TABLE stock_projection');
  }
}
