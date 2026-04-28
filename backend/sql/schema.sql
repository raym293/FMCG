CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS sku (
    sku_id TEXT PRIMARY KEY,
    sku_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_of_measure TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS location (
    location_id TEXT PRIMARY KEY,
    location_name TEXT NOT NULL,
    location_type TEXT NOT NULL CHECK (location_type IN ('plant', 'dc', 'retailer')),
    region TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS transport_lane (
    lane_id TEXT PRIMARY KEY,
    source_location_id TEXT NOT NULL REFERENCES location(location_id),
    target_location_id TEXT NOT NULL REFERENCES location(location_id),
    lead_time_days NUMERIC(10,2) NOT NULL CHECK (lead_time_days >= 0),
    cost_per_unit NUMERIC(12,4) NOT NULL CHECK (cost_per_unit >= 0),
    max_daily_capacity NUMERIC(14,2) NOT NULL CHECK (max_daily_capacity >= 0),
    UNIQUE (source_location_id, target_location_id)
);

CREATE TABLE IF NOT EXISTS promotion_calendar (
    promotion_id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL REFERENCES sku(sku_id),
    region TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    uplift_factor NUMERIC(6,3) NOT NULL CHECK (uplift_factor > 0),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS socioeconomic_signal (
    signal_date DATE NOT NULL,
    region TEXT NOT NULL,
    disposable_income_index NUMERIC(8,3) NOT NULL,
    inflation_index NUMERIC(8,3) NOT NULL,
    PRIMARY KEY (signal_date, region)
);

CREATE TABLE IF NOT EXISTS inventory_snapshot (
    observed_at TIMESTAMPTZ NOT NULL,
    sku_id TEXT NOT NULL REFERENCES sku(sku_id),
    location_id TEXT NOT NULL REFERENCES location(location_id),
    on_hand_qty NUMERIC(14,2) NOT NULL CHECK (on_hand_qty >= 0),
    in_transit_qty NUMERIC(14,2) NOT NULL CHECK (in_transit_qty >= 0),
    reserved_qty NUMERIC(14,2) NOT NULL CHECK (reserved_qty >= 0),
    PRIMARY KEY (observed_at, sku_id, location_id)
);

CREATE TABLE IF NOT EXISTS sales_transaction (
    sold_at TIMESTAMPTZ NOT NULL,
    sku_id TEXT NOT NULL REFERENCES sku(sku_id),
    retailer_location_id TEXT NOT NULL REFERENCES location(location_id),
    quantity NUMERIC(14,2) NOT NULL CHECK (quantity >= 0),
    unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
    promotion_id TEXT REFERENCES promotion_calendar(promotion_id),
    PRIMARY KEY (sold_at, sku_id, retailer_location_id)
);

SELECT create_hypertable('inventory_snapshot', 'observed_at', if_not_exists => TRUE);
SELECT create_hypertable('sales_transaction', 'sold_at', if_not_exists => TRUE);
