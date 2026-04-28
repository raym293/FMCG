import {
  AreaChart,
  Badge,
  BarChart,
  Card,
  Divider,
  DonutChart,
  Flex,
  Grid,
  LineChart,
  Metric,
  Subtitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
} from "@tremor/react";
import { useEffect, useMemo, useState } from "react";

type RegionStatus = "healthy" | "watch" | "critical";

type DashboardSnapshot = {
  kpis: {
    osa_score: number;
    inventory_health_index: number;
    skus_above_stockout_threshold: number;
  };
  region_health: Array<{
    region: string;
    stock_to_sales_ratio: number;
    status: RegionStatus;
  }>;
  priority_list: Array<{
    sku_id: string;
    region: string;
    stockout_risk_pct: number;
    recommended_action: string;
  }>;
};

type ScenarioResponse = {
  baseline: DashboardSnapshot;
  scenario: DashboardSnapshot;
};

type ForecastResponse = {
  points: Array<{ forecast_date: string; demand: number }>;
};

const API_BASE = "http://localhost:8000/api/v1";

const fallbackSnapshot: DashboardSnapshot = {
  kpis: { osa_score: 95.8, inventory_health_index: 1.07, skus_above_stockout_threshold: 3 },
  region_health: [
    { region: "West", stock_to_sales_ratio: 1.2, status: "healthy" },
    { region: "North", stock_to_sales_ratio: 1.04, status: "watch" },
    { region: "South", stock_to_sales_ratio: 0.93, status: "critical" },
    { region: "Metro", stock_to_sales_ratio: 1.1, status: "watch" },
  ],
  priority_list: [
    {
      sku_id: "SKU-1001",
      region: "South",
      stockout_risk_pct: 18.2,
      recommended_action: "Move 1,200 units from DC-North to DC-South",
    },
    {
      sku_id: "SKU-2088",
      region: "West",
      stockout_risk_pct: 16.1,
      recommended_action: "Expedite plant-to-DC lane by 2 days",
    },
    {
      sku_id: "SKU-3210",
      region: "Metro",
      stockout_risk_pct: 15.3,
      recommended_action: "Rebalance allocation across top 20 stores",
    },
  ],
};

function statusClass(status: RegionStatus): string {
  if (status === "healthy") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "watch") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}

function modernButton(kind: "primary" | "secondary"): string {
  const base =
    "h-11 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
  if (kind === "primary") {
    return `${base} bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-900/30 hover:brightness-110`;
  }
  return `${base} border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800`;
}

export default function App() {
  const [data, setData] = useState<DashboardSnapshot>(fallbackSnapshot);
  const [baseline, setBaseline] = useState<DashboardSnapshot>(fallbackSnapshot);
  const [forecast, setForecast] = useState<Array<{ date: string; demand: number }>>([]);
  const [delayDays, setDelayDays] = useState(4);
  const [selectedSku, setSelectedSku] = useState("SKU-1001");
  const [selectedRegion, setSelectedRegion] = useState("West");
  const [horizonDays, setHorizonDays] = useState(21);
  const [liveMode, setLiveMode] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(5);
  const [runningScenario, setRunningScenario] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Live mode active.");

  const riskAvg = useMemo(() => {
    const total = data.priority_list.reduce((sum, item) => sum + item.stockout_risk_pct, 0);
    return +(total / Math.max(1, data.priority_list.length)).toFixed(1);
  }, [data]);

  const forecastChart = useMemo(() => {
    if (forecast.length) return forecast;
    const today = new Date();
    return Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + idx);
      return {
        date: d.toISOString().slice(0, 10),
        demand: Math.round(95 + Math.sin(idx / 2) * 9 + idx * 0.6),
      };
    });
  }, [forecast]);

  const regionBars = useMemo(
    () =>
      data.region_health.map((r) => ({
        region: r.region,
        ratio: +r.stock_to_sales_ratio.toFixed(2),
        target: 1.2,
      })),
    [data]
  );

  const donutData = useMemo(
    () =>
      data.priority_list.map((r) => ({
        name: `${r.sku_id} ${r.region}`,
        value: +r.stockout_risk_pct.toFixed(1),
      })),
    [data]
  );

  const osaTrend = useMemo(() => {
    const start = baseline.kpis.osa_score;
    const end = data.kpis.osa_score;
    return ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "D0"].map((d, i, arr) => {
      const t = (i + 1) / arr.length;
      return {
        day: d,
        baseline: +(start - (arr.length - i) * 0.08).toFixed(1),
        simulated: +(start + (end - start) * t).toFixed(1),
      };
    });
  }, [baseline, data]);

  async function loadSnapshot(silent = false): Promise<void> {
    if (!silent) setLoadingSnapshot(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/snapshot`);
      if (!res.ok) throw new Error("snapshot");
      const json = (await res.json()) as DashboardSnapshot;
      setData(json);
      setBaseline(json);
      setStatusMessage("Connected to backend live data.");
      if (json.priority_list[0]?.sku_id) setSelectedSku(json.priority_list[0].sku_id);
      if (json.region_health[0]?.region) setSelectedRegion(json.region_health[0].region);
    } catch {
      setStatusMessage("Backend unavailable. Showing local live fallback data.");
      const jitter = (Math.random() - 0.5) * 0.04;
      setData((prev) => ({
        ...prev,
        kpis: {
          ...prev.kpis,
          osa_score: +(prev.kpis.osa_score + jitter * 8).toFixed(1),
          inventory_health_index: +(prev.kpis.inventory_health_index + jitter).toFixed(2),
        },
        region_health: prev.region_health.map((r, i) => ({
          ...r,
          stock_to_sales_ratio: +Math.max(0.78, r.stock_to_sales_ratio + jitter * (i + 1)).toFixed(2),
        })),
      }));
    } finally {
      if (!silent) setLoadingSnapshot(false);
    }
  }

  async function loadForecast(silent = false): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_id: selectedSku,
          region: selectedRegion,
          horizon_days: horizonDays,
          use_model: "statsmodels",
        }),
      });
      if (!res.ok) throw new Error("forecast");
      const json = (await res.json()) as ForecastResponse;
      setForecast(json.points.map((p) => ({ date: p.forecast_date, demand: +p.demand.toFixed(1) })));
    } catch {
      if (!silent) {
        setForecast([]);
      }
    }
  }

  async function runScenario(): Promise<void> {
    setRunningScenario(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delay_days: delayDays }),
      });
      if (!res.ok) throw new Error("scenario");
      const json = (await res.json()) as ScenarioResponse;
      setBaseline(json.baseline);
      setData(json.scenario);
      setStatusMessage(`Scenario applied: +${delayDays} day disruption.`);
    } catch {
      setData((prev) => ({
        ...prev,
        kpis: {
          ...prev.kpis,
          osa_score: +(prev.kpis.osa_score - delayDays * 0.3).toFixed(1),
        },
      }));
      setStatusMessage("Backend scenario unavailable. Applied local simulation fallback.");
    } finally {
      setRunningScenario(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  useEffect(() => {
    void loadForecast(true);
  }, [selectedSku, selectedRegion, horizonDays]);

  useEffect(() => {
    if (!liveMode) return;
    const id = window.setInterval(() => {
      void loadSnapshot(true);
      void loadForecast(true);
    }, Math.max(2, refreshSeconds) * 1000);
    return () => window.clearInterval(id);
  }, [liveMode, refreshSeconds, selectedSku, selectedRegion, horizonDays]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Flex justifyContent="between" className="items-end">
          <div>
            <Title>Supply Chain Control Tower</Title>
            <Subtitle>Live analytics, forecasts, and disruption simulation</Subtitle>
            <Text className="mt-1 text-xs text-cyan-300">{statusMessage}</Text>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <Text className="text-xs text-slate-400">Auto refresh</Text>
              <div className="mt-1 flex items-center gap-2">
                <button className={modernButton(liveMode ? "primary" : "secondary")} onClick={() => setLiveMode(true)}>
                  Live ON
                </button>
                <button className={modernButton(!liveMode ? "primary" : "secondary")} onClick={() => setLiveMode(false)}>
                  Live OFF
                </button>
                <select
                  className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm"
                  value={refreshSeconds}
                  onChange={(e) => setRefreshSeconds(Number(e.target.value))}
                >
                  <option value={3}>3s</option>
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                </select>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <Text className="text-xs text-slate-400">Port delay (days)</Text>
              <input
                type="range"
                min={0}
                max={14}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="mt-1 w-40 accent-cyan-400"
              />
              <Text className="text-xs">{delayDays} days</Text>
            </div>
            <button className={modernButton("primary")} onClick={runScenario} disabled={runningScenario}>
              {runningScenario ? "Applying..." : "Run Scenario"}
            </button>
            <button className={modernButton("secondary")} onClick={() => loadSnapshot()} disabled={loadingSnapshot}>
              {loadingSnapshot ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </Flex>

        <Grid numItems={1} numItemsMd={4} className="gap-4">
          <Card className="border-slate-800 bg-slate-900">
            <Text>OSA</Text>
            <Metric>{data.kpis.osa_score.toFixed(1)}%</Metric>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <Text>Inventory Health</Text>
            <Metric>{data.kpis.inventory_health_index.toFixed(2)}</Metric>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <Text>SKUs &gt; 15% Risk</Text>
            <Metric>{data.kpis.skus_above_stockout_threshold}</Metric>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <Text>Average Risk</Text>
            <Metric>{riskAvg.toFixed(1)}%</Metric>
          </Card>
        </Grid>

        <Grid numItems={1} numItemsMd={2} className="gap-4">
          <Card className="border-slate-800 bg-slate-900">
            <Title>Demand Forecast</Title>
            <Text>Interactive by SKU, region, and horizon</Text>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
              >
                {data.priority_list.map((p) => (
                  <option key={p.sku_id} value={p.sku_id}>
                    {p.sku_id}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                {data.region_health.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
              </select>
              <div>
                <Text className="text-xs">Horizon: {horizonDays} days</Text>
                <input
                  type="range"
                  min={7}
                  max={60}
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
            <LineChart
              className="mt-4 h-64"
              data={forecastChart}
              index="date"
              categories={["demand"]}
              colors={["cyan"]}
              yAxisWidth={48}
            />
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <Title>Risk Composition</Title>
            <Text>SKU-level risk mix</Text>
            <DonutChart
              className="mt-4 h-64"
              data={donutData}
              category="value"
              index="name"
              colors={["rose", "amber", "indigo", "cyan", "emerald"]}
              variant="pie"
            />
          </Card>
        </Grid>

        <Grid numItems={1} numItemsMd={2} className="gap-4">
          <Card className="border-slate-800 bg-slate-900">
            <Title>Region Ratio vs Target</Title>
            <BarChart
              className="mt-4 h-64"
              data={regionBars}
              index="region"
              categories={["ratio", "target"]}
              colors={["emerald", "slate"]}
              yAxisWidth={44}
            />
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <Title>OSA: Baseline vs Scenario</Title>
            <AreaChart
              className="mt-4 h-64"
              data={osaTrend}
              index="day"
              categories={["baseline", "simulated"]}
              colors={["blue", "cyan"]}
              yAxisWidth={44}
            />
          </Card>
        </Grid>

        <Card className="border-slate-800 bg-slate-900">
          <Flex justifyContent="between">
            <Title>Priority Redistribution</Title>
            <Badge color="cyan">Live</Badge>
          </Flex>
          <Divider />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>SKU</TableHeaderCell>
                <TableHeaderCell>Region</TableHeaderCell>
                <TableHeaderCell>Risk</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.priority_list.map((row) => (
                <TableRow key={`${row.sku_id}-${row.region}`}>
                  <TableCell>{row.sku_id}</TableCell>
                  <TableCell>{row.region}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${statusClass(row.stockout_risk_pct >= 18 ? "critical" : row.stockout_risk_pct >= 15 ? "watch" : "healthy")}`}>
                      {row.stockout_risk_pct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>{row.recommended_action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </main>
  );
}
