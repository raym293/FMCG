from datetime import date, timedelta

from app.schemas.domain import ForecastPoint, ForecastRequest, ForecastResponse


def run_forecast(req: ForecastRequest) -> ForecastResponse:
    today = date.today()
    base = 100.0
    points = []
    for i in range(req.horizon_days):
        seasonal = 10.0 if (today + timedelta(days=i)).month in (11, 12) else 0.0
        promo_signal = 4.0 if i % 7 in (4, 5) else 0.0
        socioeconomic_factor = 1.05 if req.region.lower() in {"metro", "urban"} else 0.97
        demand = (base + seasonal + promo_signal) * socioeconomic_factor
        points.append(ForecastPoint(forecast_date=today + timedelta(days=i), demand=round(demand, 2)))

    return ForecastResponse(
        sku_id=req.sku_id,
        region=req.region,
        model_used=req.use_model,
        points=points,
    )
