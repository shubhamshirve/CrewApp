import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Users, AlertTriangle, Ban, CheckCircle, Search, Loader2, Filter, X, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLANS = ["", "free", "base", "premium"];
const STATUSES = ["", "pending", "approved", "rejected", "not_submitted", "suspended"];

export default function AdminUsers() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");

  // Bulk
  const [selected, setSelected] = useState(new Set());
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ title: "", message: "" });
  const [bulkLoading, setBulkLoading] = useState(false);

  // Per-row actions
  const [penaltyData, setPenaltyData] = useState({ userId: "", reason: "", stars: 1 });
  const [showPenalty, setShowPenalty] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (city) params.set("city", city);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      if (minRating) params.set("min_rating", minRating);
      if (maxRating) params.set("max_rating", maxRating);
      const r = await api.get(`/admin/users?${params.toString()}`);
      setUsers(r.data.users);
      setTotal(r.data.total);
      setSelected(new Set());
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [api, search, role, city, plan, status, minRating, maxRating]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setSearch(""); setRole(""); setCity(""); setPlan("");
    setStatus(""); setMinRating(""); setMaxRating("");
  };

  const hasFilters = search || role || city || plan || status || minRating || maxRating;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(u => u.id)));
    }
  };

  const handleBulkAction = async (action) => {
    if (action === "notify" && (!notifyForm.title || !notifyForm.message)) {
      toast.error("Title and message required"); return;
    }
    setBulkLoading(true);
    try {
      const body = { action, user_ids: Array.from(selected) };
      if (action === "notify") {
        body.title = notifyForm.title;
        body.message = notifyForm.message;
      }
      const r = await api.post("/admin/users/bulk-action", body);
      toast.success(`${r.data.updated} user(s) updated`);
      setShowNotifyModal(false);
      setNotifyForm({ title: "", message: "" });
      load();
    } catch { toast.error("Bulk action failed"); }
    finally { setBulkLoading(false); }
  };

  const handleToggleSuspend = async (userId) => {
    setActionLoading(l => ({ ...l, [userId]: true }));
    try {
      const r = await api.put(`/admin/suspend/${userId}`);
      toast.success(r.data.is_suspended ? "User suspended" : "User unsuspended");
      load();
    } catch { toast.error("Action failed"); }
    finally { setActionLoading(l => ({ ...l, [userId]: false })); }
  };

  const handlePenalty = async () => {
    if (!penaltyData.reason) { toast.error("Enter a reason"); return; }
    try {
      await api.post(`/admin/penalty/${penaltyData.userId}`, {
        reason: penaltyData.reason, stars: penaltyData.stars,
      });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyData({ userId: "", reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
  };

  const inputCls = "rounded-xl px-3 py-2 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-muted-foreground";
  const selectCls = `${inputCls} appearance-none`;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-24">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-display">Users</h1>
            <p className="text-muted-foreground text-sm mt-1">{total} registered users</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="admin-user-search"
            className={`w-full pl-10 pr-4 py-2.5 ${inputCls}`}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-muted-foreground flex-shrink-0" />
          <select
            className={`${selectCls} text-xs`}
            value={plan}
            onChange={e => setPlan(e.target.value)}
          >
            <option value="">All Plans</option>
            {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={`${selectCls} text-xs`}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            className={`${inputCls} text-xs w-28`}
            placeholder="Role…"
            value={role}
            onChange={e => setRole(e.target.value)}
          />
          <input
            className={`${inputCls} text-xs w-28`}
            placeholder="City…"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
          <input
            type="number"
            min="0" max="5" step="0.1"
            className={`${inputCls} text-xs w-20`}
            placeholder="Min ★"
            value={minRating}
            onChange={e => setMinRating(e.target.value)}
          />
          <input
            type="number"
            min="0" max="5" step="0.1"
            className={`${inputCls} text-xs w-20`}
            placeholder="Max ★"
            value={maxRating}
            onChange={e => setMaxRating(e.target.value)}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 border border-border hover:bg-slate-50 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select-all header */}
            {users.length > 0 && (
              <div className="flex items-center gap-3 px-2 pb-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-500"
                  checked={selected.size === users.length && users.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </div>
            )}

            {users.map(u => (
              <div
                key={u.id}
                data-testid={`user-row-${u.id}`}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                  selected.has(u.id)
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-500 flex-shrink-0"
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold font-display cursor-pointer bg-primary/10 text-primary"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm text-foreground font-display font-medium truncate cursor-pointer hover:text-blue-500 transition-colors"
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      {u.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email} · {u.primary_role || "No role set"}
                      {u.location && ` · ${u.location}`}
                      {u.avg_rating && ` · ★ ${u.avg_rating.toFixed(1)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.is_verified ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {u.is_verified ? "Verified" : u.verification_status}
                  </span>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.subscription_plan !== "free" ? "bg-amber-500/15 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {u.subscription_plan}
                  </span>
                  {u.is_suspended && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400">Suspended</span>
                  )}
                  {u.is_featured && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">Featured</span>
                  )}
                  {u.is_high_risk && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">High Risk</span>
                  )}
                  <button
                    data-testid={`penalty-btn-${u.id}`}
                    onClick={() => { setPenaltyData(p => ({ ...p, userId: u.id })); setShowPenalty(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 transition-colors"
                  >
                    <AlertTriangle size={11} /> Penalty
                  </button>
                  <button
                    data-testid={`suspend-btn-${u.id}`}
                    onClick={() => handleToggleSuspend(u.id)}
                    disabled={actionLoading[u.id]}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-60 ${
                      u.is_suspended
                        ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        : "text-red-400 border-red-500/30 hover:bg-red-500/10"
                    }`}
                  >
                    {actionLoading[u.id]
                      ? <Loader2 size={11} className="animate-spin" />
                      : u.is_suspended ? <CheckCircle size={11} /> : <Ban size={11} />
                    }
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl border border-border bg-white shadow-2xl z-40"
        >
          <span className="text-sm text-foreground font-display">{selected.size} selected</span>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => handleBulkAction("suspend")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-60"
          >
            Suspend
          </button>
          <button
            onClick={() => handleBulkAction("unsuspend")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
          >
            Unsuspend
          </button>
          <button
            onClick={() => handleBulkAction("verify")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors disabled:opacity-60"
          >
            Verify
          </button>
          <button
            onClick={() => setShowNotifyModal(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
          >
            <Send size={11} /> Notify
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Penalty Dialog */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" /> Apply Penalty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Stars to deduct</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50"
                value={penaltyData.stars}
                onChange={e => setPenaltyData(p => ({ ...p, stars: parseInt(e.target.value) }))}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Reason *</label>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground bg-slate-50 border border-border resize-none h-20 focus:outline-none focus:border-blue-500/50 placeholder:text-muted-foreground"
                placeholder="Explain the penalty reason…"
                value={penaltyData.reason}
                onChange={e => setPenaltyData(p => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPenalty(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-600 border border-border hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="apply-penalty-btn"
                onClick={handlePenalty}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#EA580C" }}
              >
                Apply Penalty
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify Modal */}
      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground font-display flex items-center gap-2">
              <Send size={16} className="text-amber-500" /> Notify {selected.size} Users
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Title *</label>
              <input
                className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50 placeholder:text-muted-foreground"
                placeholder="Notification title…"
                value={notifyForm.title}
                onChange={e => setNotifyForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Message *</label>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground bg-slate-50 border border-border resize-none h-24 focus:outline-none focus:border-blue-500/50 placeholder:text-muted-foreground"
                placeholder="Your message…"
                value={notifyForm.message}
                onChange={e => setNotifyForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-600 border border-border hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAction("notify")}
                disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#D97706" }}
              >
                {bulkLoading ? "Sending…" : "Send Notification"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
