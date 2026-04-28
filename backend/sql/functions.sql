CREATE OR REPLACE FUNCTION fn_safety_stock(
    z_score NUMERIC,
    sigma_l NUMERIC,
    avg_lead_time_days NUMERIC
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT ROUND(z_score * sigma_l * SQRT(NULLIF(avg_lead_time_days, 0)), 4);
$$;

CREATE OR REPLACE FUNCTION fn_reorder_point(
    avg_daily_demand NUMERIC,
    avg_lead_time_days NUMERIC,
    z_score NUMERIC,
    sigma_l NUMERIC
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT ROUND(
        (avg_daily_demand * avg_lead_time_days) +
        fn_safety_stock(z_score, sigma_l, avg_lead_time_days),
        4
    );
$$;

CREATE OR REPLACE VIEW vw_osa_region_daily AS
SELECT
    DATE(s.sold_at) AS sales_date,
    l.region,
    s.sku_id,
    SUM(
        CASE WHEN i.on_hand_qty > 0 THEN s.quantity ELSE 0 END
    ) / NULLIF(SUM(s.quantity), 0) AS osa_score
FROM sales_transaction s
JOIN location l ON l.location_id = s.retailer_location_id
LEFT JOIN LATERAL (
    SELECT i2.on_hand_qty
    FROM inventory_snapshot i2
    WHERE i2.sku_id = s.sku_id
      AND i2.location_id = s.retailer_location_id
      AND i2.observed_at <= s.sold_at
    ORDER BY i2.observed_at DESC
    LIMIT 1
) i ON TRUE
GROUP BY DATE(s.sold_at), l.region, s.sku_id;
