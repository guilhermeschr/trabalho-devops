CREATE TABLE stock (product_id uuid PRIMARY KEY, available_quantity integer NOT NULL CHECK (available_quantity >= 0), version integer NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE stock_movements (id uuid PRIMARY KEY, order_id uuid UNIQUE, product_id uuid NOT NULL REFERENCES stock(product_id), quantity integer NOT NULL CHECK (quantity > 0), kind varchar(10) NOT NULL CHECK (kind IN ('add','debit')), remaining_quantity integer NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE outbox_events (event_id uuid PRIMARY KEY, event_type varchar(80) NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL, version integer NOT NULL, published_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text);
CREATE INDEX inventory_outbox_pending ON outbox_events (occurred_at) WHERE published_at IS NULL;

CREATE TABLE migrations (id serial PRIMARY KEY, timestamp bigint NOT NULL, name varchar NOT NULL);
INSERT INTO migrations(timestamp,name) VALUES(1789689600000,'InventoryWrite1789689600000');
INSERT INTO stock VALUES('4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',18,2,now());
INSERT INTO stock_movements VALUES('8f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01','d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc','4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',2,'debit',18,now());
