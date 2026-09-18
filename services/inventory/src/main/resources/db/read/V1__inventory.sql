CREATE TABLE IF NOT EXISTS stock_projection (product_id uuid PRIMARY KEY, available_quantity integer NOT NULL CHECK (available_quantity >= 0), version integer NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS processed_events (event_id uuid PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
