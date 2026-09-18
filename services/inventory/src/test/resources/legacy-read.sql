CREATE TABLE stock_projection (product_id uuid PRIMARY KEY, available_quantity integer NOT NULL CHECK (available_quantity >= 0), version integer NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE processed_events (event_id uuid PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE migrations (id serial PRIMARY KEY, timestamp bigint NOT NULL, name varchar NOT NULL);
INSERT INTO migrations(timestamp,name) VALUES(1789689600001,'InventoryRead1789689600001');
INSERT INTO stock_projection VALUES('4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',18,2,now());
