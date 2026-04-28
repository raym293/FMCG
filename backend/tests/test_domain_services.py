import unittest

from app.schemas.domain import (
    ForecastRequest,
    OptimizationEdge,
    OptimizationRequest,
    RoutingRequest,
)
from app.services.forecasting import run_forecast
from app.services.optimization import optimize_distribution
from app.services.routing import detect_bottlenecks


class DomainServiceTests(unittest.TestCase):
    def test_forecast_horizon(self) -> None:
        response = run_forecast(ForecastRequest(sku_id="SKU-1001", region="West", horizon_days=7))
        self.assertEqual(len(response.points), 7)

    def test_optimization_returns_flows(self) -> None:
        req = OptimizationRequest(
            sku_id="SKU-1001",
            demand_by_node={"retailer-a": 90.0},
            supply_by_node={"plant-1": 100.0},
            edges=[OptimizationEdge(source="plant-1", target="retailer-a", unit_cost=1.5, capacity=120)],
        )
        result = optimize_distribution(req)
        self.assertGreaterEqual(len(result.flows), 1)

    def test_detect_bottlenecks(self) -> None:
        req = RoutingRequest(
            edges=[OptimizationEdge(source="plant-1", target="dc-west", unit_cost=2.5, capacity=100)]
        )
        result = detect_bottlenecks(req)
        self.assertEqual(len(result.bottlenecks), 1)


if __name__ == "__main__":
    unittest.main()
