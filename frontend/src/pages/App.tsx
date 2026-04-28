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

function riskLevel(pct: number): RegionStatus {
  if (pct >= 18) return "critical";
  if (pct >= 15) return "watch";
  return "healthy";
}

function statusBadge(status: RegionStatus) {
  const cfg = {
    healthy: { dot: "bg-emerald-400", pill: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30", label: "Healthy" },
    watch: { dot: "bg-amber-400", pill: "bg-amber-500/10 text-amber-300 border border-amber-500/30", label: "Watch" },
    critical: { dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-300 border border-rose-500/30", label: "Critical" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
};

function KpiCard({ label, value, sub, accent, icon, trend }: KpiCardProps) {
  const trendCfg =
    trend === "up"
      ? { arrow: "↑", cls: "text-emerald-400" }
      : trend === "down"
      ? { arrow: "↓", cls: "text-rose-400" }
      : null;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm`}
    >
      <div className={`absolute right-4 top-4 rounded-xl p-2.5 ${accent}`}>{icon}</div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-50">{value}</p>
      {(sub || trendCfg) && (
        <p className={`mt-1 text-xs ${trendCfg ? trendCfg.cls : "text-slate-500"}`}>
          {trendCfg && <span className="mr-1">{trendCfg.arrow}</span>}
          {sub}
        </p>
      )}
    </div>
  );
}

type Tab = "overview" | "forecast" | "scenario" | "priorities";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "forecast", label: "Forecast", icon: "📈" },
  { id: "scenario", label: "Disruption Sim", icon: "⚡" },
  { id: "priorities", label: "Priorities", icon: "🎯" },
];

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
  const [statusMessage, setStatusMessage] = useState("Connecting to data source…");
  const [isLive, setIsLive] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [scenarioApplied, setScenarioApplied] = useState(false);

  const riskAvg = useMemo(() => {
    const total = data.priority_list.reduce((sum, item) => sum + item.stockout_risk_pct, 0);
    return +(total / Math.max(1, data.priority_list.length)).toFixed(1);
  }, [data]);

  const forecastChart = useMemo(() => {
    if (forecast.length) return forecast;
    const today = new Date();
    return Array.from({ length: horizonDays }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + idx);
      return {
        date: d.toISOString().slice(0, 10),
        demand: Math.round(95 + Math.sin(idx / 2) * 9 + idx * 0.6),
      };
    });
  }, [forecast, horizonDays]);

  const regionBars = useMemo(
    () =>
      data.region_health.map((r) => ({
        region: r.region,
        "Stock/Sales": +r.stock_to_sales_ratio.toFixed(2),
        Target: 1.2,
      })),
    [data]
  );

  const donutData = useMemo(
    () =>
      data.priority_list.map((r) => ({
        name: `${r.sku_id} (${r.region})`,
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
        Baseline: +(start - (arr.length - i) * 0.08).toFixed(1),
        Simulated: +(start + (end - start) * t).toFixed(1),
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
      setIsLive(true);
      setStatusMessage("● Connected — live backend data");
      if (json.priority_list[0]?.sku_id) setSelectedSku(json.priority_list[0].sku_id);
      if (json.region_health[0]?.region) setSelectedRegion(json.region_health[0].region);
    } catch {
      setIsLive(false);
      setStatusMessage("○ Backend offline — showing simulated data");
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
      if (!silent) setForecast([]);
    }
  }

  async function runScenario(): Promise<void> {
    setRunningScenario(true);
    setScenarioApplied(false);
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
      setStatusMessage(`Scenario: +${delayDays}-day disruption applied`);
    } catch {
      setData((prev) => ({
        ...prev,
        kpis: {
          ...prev.kpis,
          osa_score: +(prev.kpis.osa_score - delayDays * 0.3).toFixed(1),
        },
      }));
      setStatusMessage(`Local sim: +${delayDays}-day disruption applied`);
    } finally {
      setRunningScenario(false);
      setScenarioApplied(true);
    }
  }

  function resetScenario() {
    setData(baseline);
    setScenarioApplied(false);
    setDelayDays(4);
    setStatusMessage("Scenario reset — showing baseline data");
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

  const osaChange = +(data.kpis.osa_score - baseline.kpis.osa_score).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#0b0f1a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold">
              SC
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Supply Chain Control Tower</p>
              <p className="mt-0.5 text-xs text-slate-500">FMCG Digital Twin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                isLive
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-amber-500/10 text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive ? "animate-pulse bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {statusMessage}
            </span>

            <button
              onClick={() => loadSnapshot()}
              disabled={loadingSnapshot}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
            >
              <svg className={`h-3.5 w-3.5 ${loadingSnapshot ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loadingSnapshot ? "Refreshing…" : "Refresh"}
            </button>

            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
              <button
                onClick={() => setLiveMode(true)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  liveMode
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setLiveMode(false)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  !liveMode
                    ? "bg-slate-600 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Paused
              </button>
            </div>

            {liveMode && (
              <select
                className="h-8 rounded-lg border border-slate-700 bg-slate-800 px-2 text-xs text-slate-300"
                value={refreshSeconds}
                onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
              </select>
            )}
          </div>
        </div>

        {/* ── Tab nav ── */}
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1 pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition ${
                  activeTab === t.id
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* ── KPI Cards (always visible) ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="On-Shelf Availability"
            value={`${data.kpis.osa_score.toFixed(1)}%`}
            sub={scenarioApplied ? `${osaChange >= 0 ? "+" : ""}${osaChange}% vs baseline` : "Target: 98%"}
            accent="bg-cyan-500/10 text-cyan-400"
            trend={scenarioApplied ? (osaChange >= 0 ? "up" : "down") : "neutral"}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <KpiCard
            label="Inventory Health Index"
            value={data.kpis.inventory_health_index.toFixed(2)}
            sub={data.kpis.inventory_health_index >= 1 ? "Above threshold" : "Below threshold"}
            accent="bg-emerald-500/10 text-emerald-400"
            trend={data.kpis.inventory_health_index >= 1 ? "up" : "down"}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <KpiCard
            label="SKUs Above 15% Risk"
            value={String(data.kpis.skus_above_stockout_threshold)}
            sub="Requiring attention"
            accent="bg-rose-500/10 text-rose-400"
            trend={data.kpis.skus_above_stockout_threshold > 3 ? "down" : "neutral"}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <KpiCard
            label="Avg Stockout Risk"
            value={`${riskAvg.toFixed(1)}%`}
            sub="Across priority SKUs"
            accent="bg-amber-500/10 text-amber-400"
            trend={riskAvg > 16 ? "down" : "neutral"}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Grid numItems={1} numItemsMd={2} className="gap-4">
              <Card className="border-slate-800 bg-slate-900/60 p-5">
                <Title className="text-slate-200">Region Stock-to-Sales vs Target</Title>
                <Text className="text-slate-500">Inventory coverage ratio by region</Text>
                <BarChart
                  className="mt-4 h-64"
                  data={regionBars}
                  index="region"
                  categories={["Stock/Sales", "Target"]}
                  colors={["cyan", "slate"]}
                  yAxisWidth={44}
                  showLegend
                />
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 p-5">
                <Title className="text-slate-200">Stockout Risk Composition</Title>
                <Text className="text-slate-500">SKU-level risk distribution</Text>
                <DonutChart
                  className="mt-4 h-64"
                  data={donutData}
                  category="value"
                  index="name"
                  colors={["rose", "amber", "indigo"]}
                  showLabel
                  label={`${riskAvg}%`}
                />
              </Card>
            </Grid>

            <Card className="border-slate-800 bg-slate-900/60 p-5">
              <Flex justifyContent="between" className="mb-1">
                <div>
                  <Title className="text-slate-200">Region Health Status</Title>
                  <Text className="text-slate-500">Stock-to-sales ratio and risk level</Text>
                </div>
                <Badge color="cyan">
                  {liveMode ? "Auto-refresh ON" : "Auto-refresh OFF"}
                </Badge>
              </Flex>
              <Divider className="border-slate-800" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {data.region_health.map((r) => (
                  <div
                    key={r.region}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-200">{r.region}</p>
                      {statusBadge(r.status)}
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-100">
                      {r.stock_to_sales_ratio.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">Stock / Sales ratio</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          r.status === "healthy"
                            ? "bg-emerald-400"
                            : r.status === "watch"
                            ? "bg-amber-400"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, (r.stock_to_sales_ratio / 1.5) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Forecast Tab ── */}
        {activeTab === "forecast" && (
          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/60 p-5">
              <Flex justifyContent="between" className="mb-4 flex-wrap gap-3">
                <div>
                  <Title className="text-slate-200">Demand Forecast</Title>
                  <Text className="text-slate-500">
                    {selectedSku} · {selectedRegion} · {horizonDays}-day horizon
                  </Text>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">SKU</label>
                    <select
                      className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                      value={selectedSku}
                      onChange={(e) => setSelectedSku(e.target.value)}
                    >
                      {data.priority_list.map((p) => (
                        <option key={p.sku_id} value={p.sku_id}>
                          {p.sku_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Region</label>
                    <select
                      className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                    >
                      {data.region_health.map((r) => (
                        <option key={r.region} value={r.region}>
                          {r.region}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Horizon: {horizonDays} days</label>
                    <input
                      type="range"
                      min={7}
                      max={60}
                      value={horizonDays}
                      onChange={(e) => setHorizonDays(Number(e.target.value))}
                      className="mt-1 w-32 accent-cyan-400"
                    />
                  </div>
                </div>
              </Flex>
              <LineChart
                className="h-72"
                data={forecastChart}
                index="date"
                categories={["demand"]}
                colors={["cyan"]}
                yAxisWidth={48}
                showLegend
                curveType="natural"
              />
            </Card>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Peak Demand", value: Math.max(...forecastChart.map((d) => d.demand)), unit: " units" },
                { label: "Avg Demand", value: Math.round(forecastChart.reduce((s, d) => s + d.demand, 0) / forecastChart.length), unit: " units/day" },
                { label: "Days Covered", value: horizonDays, unit: " days" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-100">{s.value}<span className="text-sm text-slate-400">{s.unit}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Scenario Tab ── */}
        {activeTab === "scenario" && (
          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/60 p-5">
              <Title className="text-slate-200">Disruption Simulation</Title>
              <Text className="text-slate-500">Model the impact of a port/supply delay on On-Shelf Availability</Text>
              <Divider className="border-slate-800" />

              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-300">
                    Port Delay: <span className="text-cyan-400 font-bold">{delayDays} days</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={14}
                    value={delayDays}
                    onChange={(e) => setDelayDays(Number(e.target.value))}
                    className="w-64 accent-cyan-400"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0 days</span>
                    <span>14 days</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={runScenario}
                    disabled={runningScenario}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningScenario ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Simulating…
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Run Simulation
                      </>
                    )}
                  </button>

                  {scenarioApplied && (
                    <button
                      onClick={resetScenario}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 109-9M3 3v5h5" />
                      </svg>
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {scenarioApplied && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium text-amber-300">
                    ⚡ Scenario active: +{delayDays}-day supply disruption
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    OSA impact: <span className={osaChange >= 0 ? "text-emerald-400" : "text-rose-400"}>{osaChange >= 0 ? "+" : ""}{osaChange}%</span> vs baseline
                  </p>
                </div>
              )}
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 p-5">
              <Title className="text-slate-200">OSA: Baseline vs Simulated</Title>
              <Text className="text-slate-500">On-Shelf Availability trajectory under disruption</Text>
              <AreaChart
                className="mt-4 h-72"
                data={osaTrend}
                index="day"
                categories={["Baseline", "Simulated"]}
                colors={["blue", "cyan"]}
                yAxisWidth={44}
                showLegend
                curveType="natural"
              />
            </Card>
          </div>
        )}

        {/* ── Priorities Tab ── */}
        {activeTab === "priorities" && (
          <Card className="border-slate-800 bg-slate-900/60 p-5">
            <Flex justifyContent="between" className="mb-1">
              <div>
                <Title className="text-slate-200">Priority Redistribution Actions</Title>
                <Text className="text-slate-500">Recommended interventions ranked by stockout risk</Text>
              </div>
              <Badge color="cyan">
                {data.priority_list.length} items
              </Badge>
            </Flex>
            <Divider className="border-slate-800" />
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="text-slate-400">SKU</TableHeaderCell>
                  <TableHeaderCell className="text-slate-400">Region</TableHeaderCell>
                  <TableHeaderCell className="text-slate-400">Risk Level</TableHeaderCell>
                  <TableHeaderCell className="text-slate-400">Risk %</TableHeaderCell>
                  <TableHeaderCell className="text-slate-400">Recommended Action</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.priority_list
                  .slice()
                  .sort((a, b) => b.stockout_risk_pct - a.stockout_risk_pct)
                  .map((row) => (
                    <TableRow key={`${row.sku_id}-${row.region}`} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell>
                        <span className="font-mono text-sm font-semibold text-slate-200">{row.sku_id}</span>
                      </TableCell>
                      <TableCell className="text-slate-300">{row.region}</TableCell>
                      <TableCell>{statusBadge(riskLevel(row.stockout_risk_pct))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-slate-800">
                            <div
                              className={`h-1.5 rounded-full ${
                                riskLevel(row.stockout_risk_pct) === "critical"
                                  ? "bg-rose-500"
                                  : "bg-amber-400"
                              }`}
                              style={{ width: `${Math.min(100, row.stockout_risk_pct * 4)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-200">{row.stockout_risk_pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">{row.recommended_action}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </div>
  );
}
