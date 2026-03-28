// frontend/src/pages/admin/AdminLogs.jsx
import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ScrollText, RefreshCw, ChevronLeft, ChevronRight,
  Activity, AlertCircle, CreditCard, Cpu, MessageSquare, LogIn,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const selectClass =
  "bg-slate-50 border border-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500/60 font-display";

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

function trunc(val, n = 55) {
  if (val === null || val === undefined) return "—";
  const s = typeof val === "object" ? JSON.stringify(val) : String(val);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function Pill({ label, color = "blue" }) {
  const map = {
    blue:  "bg-blue-500/15  text-blue-600  border-blue-200",
    red:   "bg-red-500/15   text-red-600   border-red-200",
    green: "bg-emerald-500/15 text-emerald-600 border-emerald-200",
    amber: "bg-amber-500/15 text-amber-700 border-amber-200",
    zinc:  "bg-slate-100    text-slate-500  border-slate-200",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border font-display ${map[color] || map.zinc}`}>
      {label}
    </span>
  );
}

function LogTable({ columns, rows, loading, total, skip, onSkipChange }) {
  const from = total === 0 ? 0 : skip + 1;
  const to   = Math.min(skip + PAGE_SIZE, total);
  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-12 font-display">No logs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="text-left text-muted-foreground font-display text-[11px] pb-2 pr-4 border-b border-border whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id || i} className="border-b border-border hover:bg-slate-50 transition-colors">
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="py-2 pr-4 text-foreground align-top"
                      title={col.rawTitle
                        ? (typeof row[col.rawTitle] === "object"
                          ? JSON.stringify(row[col.rawTitle])
                          : String(row[col.rawTitle] ?? ""))
                        : undefined}
                    >
                      {col.render
                        ? col.render(row)
                        : <span className="font-mono">{trunc(row[col.key])}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground font-display">{from}–{to} of {total}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border text-slate-600"
              onClick={() => onSkipChange(skip - PAGE_SIZE)} disabled={skip === 0} aria-label="Previous page">
              <ChevronLeft size={12} />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border text-slate-600"
              onClick={() => onSkipChange(skip + PAGE_SIZE)} disabled={to >= total} aria-label="Next page">
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function useLogFetch(api, endpoint) {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [skip,    setSkip]    = useState(0);
  const [filters, setFilters] = useState({});

  const load = useCallback(async (s, f) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, skip: s, ...f };
      Object.keys(params).forEach(k => { if (params[k] === "" || params[k] === undefined) delete params[k]; });
      const res = await api.get(`${endpoint}?${new URLSearchParams(params)}`);
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [api, endpoint]);

  useEffect(() => { load(0, {}); }, [load]);

  const handleSkip   = (s) => { setSkip(s); load(s, filters); };
  const handleFilter = (key, val) => {
    const f = { ...filters, [key]: val };
    setFilters(f); setSkip(0); load(0, f);
  };
  const refresh = () => load(skip, filters);

  return { items, total, loading, skip, filters, handleSkip, handleFilter, refresh };
}

function ActivityTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/admin-actions");
  const ACTIONS = ["","verify_user","reject_user","bulk_suspend","bulk_unsuspend",
                   "bulk_verify","bulk_notify","wallet_credit","wallet_debit",
                   "set_flags","add_penalty","toggle_suspend"];
  const columns = [
    { key: "created_at",  label: "Time",       render: r => <span className="font-mono text-muted-foreground text-[10px]">{fmt(r.created_at)}</span> },
    { key: "admin_email", label: "Admin",      render: r => <span className="font-mono text-blue-600">{trunc(r.admin_email, 28)}</span> },
    { key: "action",      label: "Action",     render: r => <Pill label={r.action} color="blue" /> },
    { key: "target_type", label: "Target",     render: r => <span className="font-mono text-slate-600">{r.target_type}</span> },
    { key: "target_id",   label: "Target ID",  render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.target_id, 16)}</span> },
    { key: "before", label: "Before → After", rawTitle: "before", render: r => (
      <div className="space-y-0.5 max-w-xs">
        <div className="font-mono text-muted-foreground text-[10px]">{trunc(JSON.stringify(r.before), 40)}</div>
        <div className="font-mono text-emerald-600 text-[10px]">{trunc(JSON.stringify(r.after), 40)}</div>
      </div>
    )},
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.action || ""} onChange={e => handleFilter("action", e.target.value)}>
          {ACTIONS.map(a => <option key={a} value={a}>{a || "All actions"}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function ApiErrorsTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/api-errors");
  const columns = [
    { key: "created_at",   label: "Time",         render: r => <span className="font-mono text-muted-foreground text-[10px]">{fmt(r.created_at)}</span> },
    { key: "status_code",  label: "Status",        render: r => <Pill label={r.status_code} color={r.status_code >= 500 ? "red" : "amber"} /> },
    { key: "method",       label: "Method + Path", render: r => <span className="font-mono"><span className="text-muted-foreground">{r.method} </span><span className="text-slate-600">{trunc(r.path, 38)}</span></span> },
    { key: "user_id",      label: "User",          render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.user_id || "anon", 16)}</span> },
    { key: "error_detail", label: "Error",         rawTitle: "error_detail", render: r => <span className="font-mono text-red-600">{trunc(r.error_detail, 50)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.status_code || ""} onChange={e => handleFilter("status_code", e.target.value ? Number(e.target.value) : "")}>
          <option value="">All codes</option>
          {["400","401","403","404","422","500"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function PaymentsTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/payments");
  const columns = [
    { key: "created_at",         label: "Time",     render: r => <span className="font-mono text-muted-foreground text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",            label: "User",     render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.user_id, 16)}</span> },
    { key: "event",              label: "Event",    render: r => <Pill label={r.event} color={r.event === "payment_failed" ? "red" : r.event === "payment_verified" ? "green" : "blue"} /> },
    { key: "amount_paise",       label: "Amount",   render: r => <span className="font-mono text-foreground">{r.amount_paise != null ? `₹${(r.amount_paise/100).toFixed(2)}` : "—"}</span> },
    { key: "plan",               label: "Plan",     render: r => r.plan ? <Pill label={r.plan} color="zinc" /> : <span className="text-muted-foreground">—</span> },
    { key: "status",             label: "Status",   render: r => <Pill label={r.status || "—"} color={r.status === "success" ? "green" : r.status === "failed" ? "red" : "zinc"} /> },
    { key: "razorpay_order_id",  label: "Order ID", render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.razorpay_order_id, 20)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.event || ""} onChange={e => handleFilter("event", e.target.value)}>
          <option value="">All events</option>
          {["order_created","wallet_covered","payment_verified","payment_failed"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function AiUsageTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/ai-usage");
  const columns = [
    { key: "created_at",        label: "Time",       render: r => <span className="font-mono text-muted-foreground text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",           label: "User",       render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.user_id, 16)}</span> },
    { key: "endpoint",          label: "Endpoint",   render: r => <Pill label={r.endpoint} color="blue" /> },
    { key: "session_id",        label: "Session",    render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.session_id, 24)}</span> },
    { key: "prompt_chars",      label: "Chars p/r",  render: r => <span className="font-mono text-slate-600">{r.prompt_chars} / {r.response_chars}</span> },
    { key: "cost_estimate_inr", label: "Cost ₹",     render: r => <span className="font-mono text-amber-700">{r.cost_estimate_inr != null ? `₹${r.cost_estimate_inr.toFixed(5)}` : "—"}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.endpoint || ""} onChange={e => handleFilter("endpoint", e.target.value)}>
          <option value="">All endpoints</option>
          <option value="crew-suggestions">crew-suggestions</option>
          <option value="gig-checklist">gig-checklist</option>
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function WhatsAppTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/whatsapp");
  const columns = [
    { key: "created_at", label: "Time",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at || r.sent_at)}</span> },
    { key: "user_id",    label: "User",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{trunc(r.user_id || "—", 16)}</span> },
    { key: "phone",      label: "Phone",    render: r => <span className="font-mono text-slate-600">{r.phone}</span> },
    { key: "type",       label: "Template", render: r => <Pill label={r.type || r.template || "—"} color="blue" /> },
    { key: "status",     label: "Status",   render: r => <Pill label={r.status || (r.simulated ? "simulated" : "—")} color={r.status === "failed" ? "red" : "green"} /> },
    { key: "simulated",  label: "Mode",     render: r => <Pill label={r.simulated ? "mock" : "live"} color={r.simulated ? "zinc" : "green"} /> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.status || ""} onChange={e => handleFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function LoginAuditTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/logins");
  const [search, setSearch] = useState(filters.user_id || "");
  const columns = [
    { key: "created_at",  label: "Time",       render: r => <span className="font-mono text-muted-foreground text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",     label: "User ID",    render: r => <span className="font-mono text-slate-600 text-[10px]">{trunc(r.user_id, 20)}</span> },
    { key: "ip",          label: "IP Address", render: r => <span className="font-mono text-slate-600">{r.ip || "—"}</span> },
    { key: "user_agent",  label: "Device",     rawTitle: "user_agent", render: r => <span className="font-mono text-muted-foreground text-[10px]">{trunc(r.user_agent, 45)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="bg-slate-50 border border-border text-foreground text-xs rounded-lg px-3 py-1.5 outline-none focus:border-blue-500/60 font-mono w-56"
          placeholder="Filter by user ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFilter("user_id", search)}
        />
        <Button variant="outline" size="sm" onClick={() => handleFilter("user_id", search)}
          className="border-border text-slate-600 text-xs h-8">
          Search
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} className="border-border text-slate-600 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

const Card = ({ children }) => (
  <div className="rounded-xl border border-border bg-white p-5 mt-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
    {children}
  </div>
);

export default function AdminLogs() {
  const { api } = useAuth();
  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <ScrollText size={20} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-semibold text-foreground font-display">Logs & Monitoring</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Admin actions, API errors, payments, AI usage, WhatsApp, and login audit
            </p>
          </div>
        </div>

        <Tabs defaultValue="activity">
          <TabsList className="border border-border bg-slate-100 flex-wrap h-auto gap-0.5">
            {[
              { value: "activity",   icon: Activity,      label: "Activity" },
              { value: "api-errors", icon: AlertCircle,   label: "API Errors" },
              { value: "payments",   icon: CreditCard,    label: "Payments" },
              { value: "ai-usage",   icon: Cpu,           label: "AI Usage" },
              { value: "whatsapp",   icon: MessageSquare, label: "WhatsApp" },
              { value: "logins",     icon: LogIn,         label: "Login Audit" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value}
                className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs gap-1.5">
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="activity">   <Card><ActivityTab   api={api} /></Card></TabsContent>
          <TabsContent value="api-errors"> <Card><ApiErrorsTab  api={api} /></Card></TabsContent>
          <TabsContent value="payments">   <Card><PaymentsTab   api={api} /></Card></TabsContent>
          <TabsContent value="ai-usage">   <Card><AiUsageTab    api={api} /></Card></TabsContent>
          <TabsContent value="whatsapp">   <Card><WhatsAppTab   api={api} /></Card></TabsContent>
          <TabsContent value="logins">     <Card><LoginAuditTab api={api} /></Card></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
