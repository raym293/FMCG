from app.schemas.domain import OptimizationEdge, OptimizationRequest
from app.services.optimization import optimize_distribution


def main() -> None:
    req = OptimizationRequest(
        sku_id="SKU-1001",
        demand_by_node={"dc-west": 0.0, "retailer-a": 120.0, "retailer-b": 90.0},
        supply_by_node={"plant-1": 240.0, "dc-west": 0.0},
        edges=[
            OptimizationEdge(source="plant-1", target="dc-west", unit_cost=2.5, capacity=250),
            OptimizationEdge(source="dc-west", target="retailer-a", unit_cost=1.5, capacity=150),
            OptimizationEdge(source="dc-west", target="retailer-b", unit_cost=1.2, capacity=120),
        ],
    )
    result = optimize_distribution(req)
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
