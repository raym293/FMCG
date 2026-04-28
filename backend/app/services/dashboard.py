import math
from datetime import datetime
from typing import Literal

from app.schemas.domain import (
    DashboardKpis,
    DashboardSnapshotResponse,
    PrioritySku,
    RegionHealth,
    ScenarioResponse,
)


def _status_from_ratio(ratio: float) -> Literal["healthy", "watch", "critical"]:
    if ratio >= 1.15:
        return "healthy"
    if ratio >= 1.0:
        return "watch"
    return "critical"


def get_dashboard_snapshot() -> DashboardSnapshotResponse:
    now = datetime.utcnow()
    phase = (now.minute * 60 + now.second) / 60.0
    drift = math.sin(phase / 4.0) * 0.06
    risk_drift = max(-1.5, min(2.4, math.cos(phase / 5.0) * 1.8))

    region_health = [
        RegionHealth(
            region="West",
            stock_to_sales_ratio=round(1.22 + drift, 2),
            status=_status_from_ratio(1.22 + drift),
        ),
        RegionHealth(
            region="North",
            stock_to_sales_ratio=round(1.06 - drift / 2, 2),
            status=_status_from_ratio(1.06 - drift / 2),
        ),
        RegionHealth(
            region="South",
            stock_to_sales_ratio=round(0.94 - drift, 2),
            status=_status_from_ratio(0.94 - drift),
        ),
        RegionHealth(
            region="Metro",
            stock_to_sales_ratio=round(1.13 + drift / 3, 2),
            status=_status_from_ratio(1.13 + drift / 3),
        ),
    ]

    priority = [
        PrioritySku(
            sku_id="SKU-1001",
            region="South",
            stockout_risk_pct=round(18.0 + risk_drift, 1),
            recommended_action="Move 1,200 units from DC-North to DC-South",
        ),
        PrioritySku(
            sku_id="SKU-2088",
            region="West",
            stockout_risk_pct=round(16.0 + risk_drift * 0.8, 1),
            recommended_action="Expedite plant-to-DC lane by 2 days",
        ),
        PrioritySku(
            sku_id="SKU-3210",
            region="Metro",
            stockout_risk_pct=round(15.0 + risk_drift * 0.6, 1),
            recommended_action="Rebalance allocation across top 20 stores",
        ),
    ]

    avg_health = sum(r.stock_to_sales_ratio for r in region_health) / len(region_health)
    osa_score = round(96.0 + drift * 12, 1)

    return DashboardSnapshotResponse(
        kpis=DashboardKpis(
            osa_score=osa_score,
            inventory_health_index=round(avg_health, 2),
            skus_above_stockout_threshold=sum(1 for row in priority if row.stockout_risk_pct >= 15),
        ),
        region_health=region_health,
        priority_list=priority,
    )


def run_delay_scenario(delay_days: int) -> ScenarioResponse:
    baseline = get_dashboard_snapshot()
    risk_penalty = min(6.0, delay_days * 0.8)
    osa_penalty = min(5.0, delay_days * 0.6)

    scenario_priority = [
        PrioritySku(
            sku_id=row.sku_id,
            region=row.region,
            stockout_risk_pct=round(min(45.0, row.stockout_risk_pct + risk_penalty), 1),
            recommended_action=row.recommended_action,
        )
        for row in baseline.priority_list
    ]

    scenario_region = []
    for row in baseline.region_health:
        shifted_ratio = round(max(0.65, row.stock_to_sales_ratio - (delay_days * 0.03)), 2)
        if shifted_ratio >= 1.15:
            status = "healthy"
        elif shifted_ratio >= 1.0:
            status = "watch"
        else:
            status = "critical"
        scenario_region.append(
            RegionHealth(region=row.region, stock_to_sales_ratio=shifted_ratio, status=status)
        )

    scenario = DashboardSnapshotResponse(
        kpis=DashboardKpis(
            osa_score=round(max(85.0, baseline.kpis.osa_score - osa_penalty), 1),
            inventory_health_index=round(
                sum(r.stock_to_sales_ratio for r in scenario_region) / len(scenario_region), 2
            ),
            skus_above_stockout_threshold=sum(1 for row in scenario_priority if row.stockout_risk_pct >= 15),
        ),
        region_health=scenario_region,
        priority_list=scenario_priority,
    )

    return ScenarioResponse(baseline=baseline, scenario=scenario)
