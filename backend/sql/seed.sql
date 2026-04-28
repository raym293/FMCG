INSERT INTO sku (sku_id, sku_name, category, unit_of_measure) VALUES
('SKU-1001', 'Detergent 1L', 'Home Care', 'bottle'),
('SKU-2088', 'Shampoo 250ml', 'Personal Care', 'bottle'),
('SKU-3210', 'Diapers Pack M', 'Baby Care', 'pack')
ON CONFLICT (sku_id) DO NOTHING;

INSERT INTO location (location_id, location_name, location_type, region, latitude, longitude) VALUES
('plant-1', 'Plant Mumbai', 'plant', 'West', 19.0760, 72.8777),
('dc-west', 'DC Pune', 'dc', 'West', 18.5204, 73.8567),
('dc-north', 'DC Delhi', 'dc', 'North', 28.6139, 77.2090),
('retailer-a', 'Retail Cluster A', 'retailer', 'West', 18.6000, 73.7500),
('retailer-b', 'Retail Cluster B', 'retailer', 'West', 18.7000, 73.9500)
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO transport_lane (lane_id, source_location_id, target_location_id, lead_time_days, cost_per_unit, max_daily_capacity) VALUES
('lane-001', 'plant-1', 'dc-west', 2, 2.5, 2500),
('lane-002', 'dc-west', 'retailer-a', 1, 1.5, 1500),
('lane-003', 'dc-west', 'retailer-b', 1, 1.2, 1200),
('lane-004', 'dc-north', 'dc-west', 3, 2.8, 1800)
ON CONFLICT (lane_id) DO NOTHING;

INSERT INTO socioeconomic_signal (signal_date, region, disposable_income_index, inflation_index) VALUES
(CURRENT_DATE - INTERVAL '2 day', 'West', 102.1, 4.7),
(CURRENT_DATE - INTERVAL '1 day', 'West', 102.2, 4.8),
(CURRENT_DATE, 'West', 102.4, 4.8)
ON CONFLICT (signal_date, region) DO NOTHING;

INSERT INTO inventory_snapshot (observed_at, sku_id, location_id, on_hand_qty, in_transit_qty, reserved_qty) VALUES
(NOW() - INTERVAL '3 hour', 'SKU-1001', 'dc-west', 1200, 300, 100),
(NOW() - INTERVAL '3 hour', 'SKU-2088', 'dc-west', 800, 120, 50),
(NOW() - INTERVAL '3 hour', 'SKU-3210', 'dc-west', 600, 200, 80),
(NOW() - INTERVAL '2 hour', 'SKU-1001', 'retailer-a', 220, 30, 20),
(NOW() - INTERVAL '2 hour', 'SKU-2088', 'retailer-b', 140, 20, 10);

INSERT INTO sales_transaction (sold_at, sku_id, retailer_location_id, quantity, unit_price) VALUES
(NOW() - INTERVAL '6 hour', 'SKU-1001', 'retailer-a', 42, 9.99),
(NOW() - INTERVAL '5 hour', 'SKU-1001', 'retailer-b', 35, 9.99),
(NOW() - INTERVAL '4 hour', 'SKU-2088', 'retailer-a', 28, 6.49),
(NOW() - INTERVAL '3 hour', 'SKU-3210', 'retailer-b', 17, 13.99);
