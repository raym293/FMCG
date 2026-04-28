import os
from typing import Any

import psycopg2
from fastmcp import FastMCP

mcp = FastMCP("fmcg-digital-twin")
POSTGRES_DSN = os.getenv("POSTGRES_DSN", "postgresql://postgres:postgres@localhost:5432/fmcg")


def _query(sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    with psycopg2.connect(POSTGRES_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]


@mcp.tool()
def get_inventory_context(sku_id: str, region: str) -> list[dict[str, Any]]:
    return _query(
        """
        SELECT
            i.observed_at,
            i.sku_id,
            i.location_id,
            l.location_name,
            l.location_type,
            l.region,
            i.on_hand_qty,
            i.in_transit_qty,
            i.reserved_qty
        FROM inventory_snapshot i
        JOIN location l ON l.location_id = i.location_id
        WHERE i.sku_id = %s
          AND l.region = %s
        ORDER BY i.observed_at DESC
        LIMIT 200
        """,
        (sku_id, region),
    )


@mcp.tool()
def run_port_delay_simulation(
    sku_id: str,
    source_location_id: str,
    target_location_id: str,
    delay_days: int,
) -> dict[str, Any]:
    rows = _query(
        """
        SELECT lead_time_days, max_daily_capacity
        FROM transport_lane
        WHERE source_location_id = %s
          AND target_location_id = %s
        LIMIT 1
        """,
        (source_location_id, target_location_id),
    )
    if not rows:
        raise ValueError("No lane found for given source/target.")

    current = rows[0]
    delayed_lead_time = float(current["lead_time_days"]) + delay_days
    impacted_units = max(0.0, float(current["max_daily_capacity"]) * delay_days)
    return {
        "sku_id": sku_id,
        "source_location_id": source_location_id,
        "target_location_id": target_location_id,
        "base_lead_time_days": float(current["lead_time_days"]),
        "delayed_lead_time_days": round(delayed_lead_time, 2),
        "estimated_impacted_units": round(impacted_units, 2),
    }


if __name__ == "__main__":
    mcp.run()
