import networkx as nx

from app.schemas.domain import Bottleneck, RoutingRequest, RoutingResponse


def detect_bottlenecks(req: RoutingRequest) -> RoutingResponse:
    graph = nx.DiGraph()
    for edge in req.edges:
        graph.add_edge(edge.source, edge.target, capacity=edge.capacity)

    bottlenecks = []
    for edge in req.edges:
        simulated_flow = edge.capacity * 0.85
        utilization = simulated_flow / edge.capacity if edge.capacity else 0.0
        if utilization >= 0.8:
            bottlenecks.append(
                Bottleneck(
                    source=edge.source,
                    target=edge.target,
                    utilization_ratio=round(utilization, 3),
                )
            )

    return RoutingResponse(bottlenecks=bottlenecks)
