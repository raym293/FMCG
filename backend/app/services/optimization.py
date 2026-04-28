import pulp

from app.schemas.domain import OptimizationFlow, OptimizationRequest, OptimizationResponse


def optimize_distribution(req: OptimizationRequest) -> OptimizationResponse:
    model = pulp.LpProblem("distribution_min_cost", pulp.LpMinimize)

    flow_vars = {}
    for edge in req.edges:
        key = (edge.source, edge.target)
        flow_vars[key] = pulp.LpVariable(
            f"flow__{edge.source}__{edge.target}",
            lowBound=0,
            upBound=edge.capacity,
            cat="Continuous",
        )

    model += pulp.lpSum(
        flow_vars[(edge.source, edge.target)] * edge.unit_cost for edge in req.edges
    )

    all_nodes = (
        set(req.supply_by_node.keys())
        | set(req.demand_by_node.keys())
        | {edge.source for edge in req.edges}
        | {edge.target for edge in req.edges}
    )
    for node in all_nodes:
        outgoing = pulp.lpSum(v for (s, _), v in flow_vars.items() if s == node)
        incoming = pulp.lpSum(v for (_, t), v in flow_vars.items() if t == node)
        supply = req.supply_by_node.get(node, 0.0)
        demand = req.demand_by_node.get(node, 0.0)
        model += incoming + supply - outgoing >= demand

    status = model.solve(pulp.PULP_CBC_CMD(msg=False))
    if status != pulp.LpStatusOptimal:
        raise ValueError("Optimization could not find an optimal feasible plan.")

    flows = [
        OptimizationFlow(source=s, target=t, quantity=round(var.value() or 0.0, 3))
        for (s, t), var in flow_vars.items()
        if (var.value() or 0.0) > 0.0
    ]

    return OptimizationResponse(
        sku_id=req.sku_id,
        objective_cost=round(pulp.value(model.objective), 3),
        flows=flows,
    )
