from fastapi import APIRouter

from app.schemas.domain import (
    DashboardSnapshotResponse,
    ForecastRequest,
    ForecastResponse,
    OptimizationRequest,
    OptimizationResponse,
    ScenarioRequest,
    ScenarioResponse,
    RoutingRequest,
    RoutingResponse,
)
from app.services.dashboard import get_dashboard_snapshot, run_delay_scenario
from app.services.forecasting import run_forecast
from app.services.optimization import optimize_distribution
from app.services.routing import detect_bottlenecks

router = APIRouter(prefix="/api/v1", tags=["digital-twin"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    return run_forecast(req)


@router.post("/optimize", response_model=OptimizationResponse)
def optimize(req: OptimizationRequest) -> OptimizationResponse:
    return optimize_distribution(req)


@router.post("/routing/bottlenecks", response_model=RoutingResponse)
def routing(req: RoutingRequest) -> RoutingResponse:
    return detect_bottlenecks(req)


@router.get("/dashboard/snapshot", response_model=DashboardSnapshotResponse)
def dashboard_snapshot() -> DashboardSnapshotResponse:
    return get_dashboard_snapshot()


@router.post("/dashboard/scenario", response_model=ScenarioResponse)
def dashboard_scenario(req: ScenarioRequest) -> ScenarioResponse:
    return run_delay_scenario(req.delay_days)
