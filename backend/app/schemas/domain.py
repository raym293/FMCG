from datetime import date
from typing import Dict, List, Literal

from pydantic import BaseModel, Field


LocationType = Literal["plant", "dc", "retailer"]


class ForecastRequest(BaseModel):
    sku_id: str
    region: str
    horizon_days: int = Field(ge=1, le=90, default=14)
    use_model: Literal["statsmodels", "xgboost"] = "statsmodels"


class ForecastPoint(BaseModel):
    forecast_date: date
    demand: float


class ForecastResponse(BaseModel):
    sku_id: str
    region: str
    model_used: str
    points: List[ForecastPoint]


class OptimizationEdge(BaseModel):
    source: str
    target: str
    unit_cost: float = Field(ge=0)
    capacity: float = Field(ge=0)


class OptimizationRequest(BaseModel):
    sku_id: str
    demand_by_node: Dict[str, float]
    supply_by_node: Dict[str, float]
    edges: List[OptimizationEdge]


class OptimizationFlow(BaseModel):
    source: str
    target: str
    quantity: float


class OptimizationResponse(BaseModel):
    sku_id: str
    objective_cost: float
    flows: List[OptimizationFlow]


class RoutingRequest(BaseModel):
    edges: List[OptimizationEdge]


class Bottleneck(BaseModel):
    source: str
    target: str
    utilization_ratio: float


class RoutingResponse(BaseModel):
    bottlenecks: List[Bottleneck]


class DashboardKpis(BaseModel):
    osa_score: float
    inventory_health_index: float
    skus_above_stockout_threshold: int


class RegionHealth(BaseModel):
    region: str
    stock_to_sales_ratio: float
    status: Literal["healthy", "watch", "critical"]


class PrioritySku(BaseModel):
    sku_id: str
    region: str
    stockout_risk_pct: float
    recommended_action: str


class DashboardSnapshotResponse(BaseModel):
    kpis: DashboardKpis
    region_health: List[RegionHealth]
    priority_list: List[PrioritySku]


class ScenarioRequest(BaseModel):
    delay_days: int = Field(ge=0, le=14)


class ScenarioResponse(BaseModel):
    baseline: DashboardSnapshotResponse
    scenario: DashboardSnapshotResponse
