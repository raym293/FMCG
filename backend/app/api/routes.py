from fastapi import APIRouter

from app.schemas.domain import (
    ForecastRequest,
    ForecastResponse,
    OptimizationRequest,
    OptimizationResponse,
    RoutingRequest,
    RoutingResponse,
)
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
