import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import {
  Users, TrendingUp, CreditCard, ShieldCheck, Briefcase,
  Globe, Calendar, RefreshCw, Loader2, IndianRupee, UserCheck,
  Sparkles, CheckCircle2, Clock, DollarSign, Zap, BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Area, AreaChart,
} from "recharts";

function StatCard({ label, value, icon: Icon, color, sub, testId }) {
  return (
    <div data-testid={testId} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-display text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 font-display">{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 font-display">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload?.length) {
    return (
      <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-md text-xs font-display">
        <p className="text-slate-500 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {prefix}{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminReports() {
  const { api } = useAuth();
  const [overview, setOverview] = useState(null);
  const [regData, setRegData] = useState([]);
  const [revData, setRevData] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [tab, setTab] = useState("overview");

  // AI usage state
  const [aiUsage, setAiUsage] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, regRes, revRes, payRes, usrRes] = await Promise.all([
        api.get("/admin/reports/overview"),
        api.get(`/admin/reports/registrations?days=${range}`),
        api.get(`/admin/reports/revenue?days=${range}`),
        api.get("/admin/reports/recent-payments?limit=15"),
        api.get("/admin/reports/recent-registrations?limit=15"),
      ]);
      setOverview(ovRes.data);
      setRegData(regRes.data.data || []);
      setRevData(revRes.data.data || []);
      setRecentPayments(payRes.data.items || []);
      setRecentUsers(usrRes.data.items || []);
    } catch { toast.error("Failed to load reports"); }
    finally { setLoading(false); }
  }, [api, range]);

  const loadAiUsage = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await api.get(`/admin/reports/ai-usage?days=${range}`);
      setAiUsage(res.data);
    } catch { toast.error("Failed to load AI usage report"); }
    finally { setAiLoading(false); }
  }, [api, range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "ai") loadAiUsage(); }, [tab, loadAiUsage]);

  const shortDate = (d) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const chartRegData = regData.map(d => ({ ...d, date: shortDate(d.date) }));
  const chartRevData = revData.map(d => ({ ...d, date: shortDate(d.date) }));

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-display">Reports & Analytics</h1>
            <p className="text-slate-500 text-sm mt-0.5">Platform performance, registrations and revenue</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-slate-50">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  data-testid={`range-${d}`}
                  onClick={() => setRange(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display transition-all ${range === d ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => { load(); if (tab === "ai") loadAiUsage(); }}
              disabled={loading || aiLoading}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading || aiLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-slate-100 w-fit">
          {[
            { id: "overview", label: "Overview" },
            { id: "registrations", label: "Registrations" },
            { id: "revenue", label: "Revenue" },
            { id: "payments", label: "Payment Log" },
            { id: "ai", label: "AI Usage" },
          ].map(t => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-display transition-all whitespace-nowrap ${tab === t.id ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
            >
              {t.id === "ai" ? <span className="flex items-center gap-1"><Sparkles size={10} />{t.label}</span> : t.label}
            </button>
          ))}
        </div>

        {loading && !overview ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-400" />
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {tab === "overview" && overview && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <StatCard label="Total Users" value={overview.total_users} icon={Users} color="#3B82F6" testId="stat-total-users" />
                  <StatCard label="New (30d)" value={overview.new_users_30d} icon={TrendingUp} color="#10B981" sub={`${overview.new_users_7d} this week`} testId="stat-new-30d" />
                  <StatCard label="Verified" value={overview.verified_users} icon={UserCheck} color="#8B5CF6" testId="stat-verified" />
                  <StatCard label="Pending Verify" value={overview.pending_verification} icon={ShieldCheck} color="#F59E0B" testId="stat-pending" />
                  <StatCard label="Subscribed" value={overview.subscribed_users} icon={CreditCard} color="#EC4899" testId="stat-subscribed" />
                  <StatCard label="Revenue (30d)" value={`₹${(overview.revenue_30d || 0).toLocaleString("en-IN")}`} icon={IndianRupee} color="#F97316" testId="stat-revenue-30d" />
                  <StatCard label="Total Gigs" value={overview.total_gigs} icon={Briefcase} color="#06B6D4" testId="stat-gigs" />
                  <StatCard label="Public Gigs" value={overview.public_gigs} icon={Globe} color="#10B981" testId="stat-public-gigs" />
                </div>

                {/* Plan breakdown */}
                {overview.plan_breakdown?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Subscribers by Plan</h3>
                    <div className="space-y-2.5">
                      {overview.plan_breakdown.map((p, i) => {
                        const pct = overview.subscribed_users > 0 ? Math.round((p.count / overview.subscribed_users) * 100) : 0;
                        const colors = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899"];
                        const c = colors[i % colors.length];
                        return (
                          <div key={p.plan} className="flex items-center gap-3">
                            <span className="text-xs font-display text-slate-700 w-28 truncate">{p.plan}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                            </div>
                            <span className="text-xs font-display text-slate-500 w-12 text-right">{p.count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent users table */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Recent Registrations</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 text-left text-slate-500 font-display">Name</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Email</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Role</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Verified</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentUsers.slice(0, 8).map(u => (
                          <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-2 font-display text-slate-800">{u.full_name}</td>
                            <td className="py-2 text-slate-500 truncate max-w-[140px]">{u.email}</td>
                            <td className="py-2 text-slate-500">{u.primary_role || "—"}</td>
                            <td className="py-2">
                              {u.is_verified
                                ? <span className="text-emerald-600 font-display">✓ Yes</span>
                                : <span className="text-slate-400">No</span>}
                            </td>
                            <td className="py-2 text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REGISTRATIONS TAB */}
            {tab === "registrations" && (
              <div className="space-y-5">
                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 font-display mb-5">New Registrations (last {range} days)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartRegData}>
                      <defs>
                        <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "inherit" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="url(#regGrad)" strokeWidth={2} name="Registrations" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Recent Registrations</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 text-left text-slate-500 font-display">Name</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Email</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Role</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Plan</th>
                          <th className="pb-2 text-left text-slate-500 font-display">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentUsers.map(u => (
                          <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 font-display text-slate-800">{u.full_name}</td>
                            <td className="py-2 text-slate-500">{u.email}</td>
                            <td className="py-2 text-slate-500">{u.primary_role || "—"}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-display ${u.subscription_plan && u.subscription_plan !== "free" ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
                                {u.active_plan_name || u.subscription_plan || "Free"}
                              </span>
                            </td>
                            <td className="py-2 text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REVENUE TAB */}
            {tab === "revenue" && (
              <div className="space-y-5">
                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 font-display mb-5">Daily Revenue — last {range} days (₹)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartRevData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Bar dataKey="revenue" fill="#F97316" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                    <p className="text-xs text-slate-500 font-display mb-1">Total Revenue ({range}d)</p>
                    <p className="text-3xl font-bold text-orange-500 font-display font-mono">
                      ₹{revData.reduce((s, d) => s + d.revenue, 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                    <p className="text-xs text-slate-500 font-display mb-1">Transactions ({range}d)</p>
                    <p className="text-3xl font-bold text-blue-500 font-display">
                      {revData.reduce((s, d) => s + d.transactions, 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENT LOG TAB */}
            {tab === "payments" && (
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Recent Payments</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-2 text-left text-slate-500 font-display">User</th>
                        <th className="pb-2 text-left text-slate-500 font-display">Amount</th>
                        <th className="pb-2 text-left text-slate-500 font-display">Plan</th>
                        <th className="pb-2 text-left text-slate-500 font-display">Payment ID</th>
                        <th className="pb-2 text-left text-slate-500 font-display">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPayments.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">No payments yet</td></tr>
                      ) : recentPayments.map(p => (
                        <tr key={p.id} data-testid={`payment-row-${p.id}`} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2">
                            <div className="font-display text-slate-800">{p.user_name || "—"}</div>
                            <div className="text-slate-400 text-[10px]">{p.user_email}</div>
                          </td>
                          <td className="py-2 font-mono font-semibold text-emerald-600">
                            ₹{p.amount_paise ? (p.amount_paise / 100).toLocaleString("en-IN") : "—"}
                          </td>
                          <td className="py-2">
                            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-display text-[10px]">
                              {p.plan || "—"}
                            </span>
                          </td>
                          <td className="py-2 font-mono text-slate-400 text-[10px] max-w-[100px] truncate">{p.razorpay_payment_id || "—"}</td>
                          <td className="py-2 text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AI USAGE TAB ──────────────────────────────────────────────── */}
            {tab === "ai" && (
              <div className="space-y-5">
                {aiLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 size={28} className="animate-spin text-violet-400" />
                  </div>
                ) : aiUsage ? (
                  <>
                    {/* Cost notice */}
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-violet-200 bg-violet-50">
                      <Sparkles size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-violet-700">
                        <span className="font-semibold">Gemini 2.5 Flash</span> pricing: $0.075 / 1M input tokens · $0.30 / 1M output tokens.
                        Cost is estimated from character counts (≈ 4 chars/token). Uses your{" "}
                        <span className="font-semibold">Google Gemini API key</span>.
                        You can disable AI features in{" "}
                        <span className="font-semibold">Admin → Settings → AI Features</span>.
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label="Total Requests (All)" value={aiUsage.total_all?.toLocaleString("en-IN")} icon={Zap} color="#8B5CF6" testId="ai-total-all" />
                      <StatCard label="Requests (30d)" value={aiUsage.total_30d?.toLocaleString("en-IN")} icon={BarChart2} color="#3B82F6" sub={`${aiUsage.total_7d} this week · ${aiUsage.total_1d} today`} testId="ai-total-30d" />
                      <StatCard
                        label="Est. Cost (30d)"
                        value={`$${(aiUsage.total_cost_usd_30d || 0).toFixed(4)}`}
                        icon={DollarSign}
                        color="#10B981"
                        sub={`≈ ₹${((aiUsage.total_cost_usd_30d || 0) * 85).toFixed(2)}`}
                        testId="ai-cost-30d"
                      />
                      <StatCard
                        label="Est. Cost (All Time)"
                        value={`$${(aiUsage.total_cost_usd_all || 0).toFixed(4)}`}
                        icon={DollarSign}
                        color="#F59E0B"
                        sub={`≈ ₹${((aiUsage.total_cost_usd_all || 0) * 85).toFixed(2)}`}
                        testId="ai-cost-all"
                      />
                    </div>

                    {/* Gear automation outcomes */}
                    {aiUsage.gear_outcomes_30d && (
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">
                          Gear AI Outcomes (30d)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Auto-Approved", val: aiUsage.gear_outcomes_30d.auto_approved, color: "#10B981", icon: CheckCircle2 },
                            { label: "Pending Review", val: aiUsage.gear_outcomes_30d.pending, color: "#F59E0B", icon: Clock },
                            { label: "Already in Catalogue", val: aiUsage.gear_outcomes_30d.already_in_catalogue, color: "#3B82F6", icon: CheckCircle2 },
                          ].map(({ label, val, color, icon: IC }) => (
                            <div key={label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${color}10` }}>
                              <IC size={16} style={{ color }} />
                              <div>
                                <p className="text-xl font-bold font-display" style={{ color }}>{val ?? 0}</p>
                                <p className="text-[10px] text-slate-500 font-display">{label}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Daily requests chart */}
                    {aiUsage.daily_data?.length > 0 && (
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">
                          Daily AI Requests (last {range}d)
                        </h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={aiUsage.daily_data.map(d => ({ ...d, date: d.date.slice(5) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "inherit" }} />
                            <YAxis tick={{ fontSize: 10, fontFamily: "inherit" }} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Requests" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Endpoint breakdown table */}
                    {aiUsage.endpoint_breakdown?.length > 0 && (
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
                        <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">
                          Breakdown by Feature (30d)
                        </h3>
                        <table className="w-full text-xs font-display">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="pb-2 text-left text-slate-500">Feature / Endpoint</th>
                              <th className="pb-2 text-right text-slate-500">Requests</th>
                              <th className="pb-2 text-right text-slate-500">Input Chars</th>
                              <th className="pb-2 text-right text-slate-500">Output Chars</th>
                              <th className="pb-2 text-right text-slate-500">Est. Cost (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aiUsage.endpoint_breakdown.map(ep => (
                              <tr key={ep.endpoint} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="py-2">
                                  <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 font-mono text-[10px]">
                                    {ep.endpoint}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-semibold text-slate-800">{ep.count}</td>
                                <td className="py-2 text-right text-slate-500">{ep.prompt_chars?.toLocaleString("en-IN") || 0}</td>
                                <td className="py-2 text-right text-slate-500">{ep.response_chars?.toLocaleString("en-IN") || 0}</td>
                                <td className="py-2 text-right font-mono text-emerald-600">${ep.cost_usd?.toFixed(5) || "0.00000"}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200">
                              <td className="pt-2 font-semibold text-slate-700">Total</td>
                              <td className="pt-2 text-right font-bold text-slate-800">{aiUsage.total_30d}</td>
                              <td className="pt-2" />
                              <td className="pt-2" />
                              <td className="pt-2 text-right font-mono font-bold text-emerald-700">${(aiUsage.total_cost_usd_30d || 0).toFixed(5)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {aiUsage.total_all === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Sparkles size={32} className="mb-3 opacity-30" />
                        <p className="text-sm font-display">No AI requests yet</p>
                        <p className="text-xs mt-1">AI usage will appear here as users interact with gear suggestions</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <p className="text-sm font-display">Click the AI Usage tab to load data</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
