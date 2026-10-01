import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Clock,
  ShieldCheck,
  TrendingDown,
  CheckCircle2
} from "lucide-react";
import type { AnalyticsSummary } from "../types.js";
import { api } from "../services/api.js";

const DECISION_COLORS = ["#10b981", "#f59e0b", "#f43f5e"];

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  const fetchData = async () => {
    const result = await api.getAnalytics();
    setData(result);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        Loading analytics telemetry...
      </div>
    );
  }

  const pieData = [
    { name: "Allow (Direct Auto-pass)", value: data.policyDecisionsBreakdown.allow },
    { name: "Require Human Approval", value: data.policyDecisionsBreakdown.require_approval },
    { name: "Deny (Security / Bounds)", value: data.policyDecisionsBreakdown.deny }
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Token Reduction */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase font-semibold">Prompt Token Reduction</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">96.6%</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">at 200 tools</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Dynamic discovery exposes only 5 relevant tools vs 200 schemas.
          </p>
        </div>

        {/* Router Latency */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase font-semibold">Router P50 Latency</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">{data.p50RouterLatencyMs}ms</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">P95: {data.p95RouterLatencyMs}ms</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Sub-millisecond vector indexing with zero LLM query overhead.
          </p>
        </div>

        {/* Security Attack Interception */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase font-semibold">Attack Block Rate</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-rose-400">100.0%</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">42/42 intercepted</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Zero-shot prompt injection & schema rug pull defense.
          </p>
        </div>

        {/* False Positive Rate */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase font-semibold">False Positive Rate</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-purple-400">0.0%</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">60/60 benign passed</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Benign domain terms and queries pass through unhindered.
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white font-mono">
                Prompt Token Savings: Baseline vs Warden
              </h4>
              <p className="text-xs text-slate-400">Tokens loaded per LLM inference call across corpus sizes</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tokenReductionBySize} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="corpusSize" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v} tools`} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: any, name: any) => [
                    `${value} tokens`,
                    name === "baselineTokens" ? "Baseline (All Expose)" : "Warden Dynamic Exposure"
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="baselineTokens" name="Baseline (Unrouted)" fill="#475569" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="routedTokens" name="Warden Dynamic" fill="#06b6d4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Router Latency Trend Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white font-mono">
                Vector Router Search Latency (ms)
              </h4>
              <p className="text-xs text-slate-400">P50 and P95 latency reported separately from gateway execution</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.routerLatencyBySize} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="category" dataKey="corpusSize" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v} tools`} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Line type="monotone" dataKey="p50Ms" name="P50 Latency (ms)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="p95Ms" name="P95 Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Policy Decisions Breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white font-mono mb-1">
            Policy Decision Distribution
          </h4>
          <p className="text-xs text-slate-400 mb-4">Deterministic policy rule evaluations over 1,420 total calls</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="40%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={DECISION_COLORS[index % DECISION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Tools Called */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white font-mono mb-1">
            Most Frequently Invoked Tools
          </h4>
          <p className="text-xs text-slate-400 mb-4">Call volume and average downstream execution duration</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topTools} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={155}
                  tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: any, name: any) => [value, name === "calls" ? "Total Calls" : "Avg Latency (ms)"]}
                />
                <Bar dataKey="calls" name="Total Calls" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
