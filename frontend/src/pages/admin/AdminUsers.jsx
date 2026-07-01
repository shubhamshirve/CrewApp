import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import {
  Users, AlertTriangle, Ban, CheckCircle, Search, Loader2, Filter, X, Send,
  MoreHorizontal, Eye, Zap, Shield, Flag, Wallet, Star, ShieldCheck,
  CreditCard, CalendarClock, KeyRound, Copy,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLANS = ["", "free", "base", "premium"];
const STATUSES = ["", "pending", "approved", "rejected", "not_submitted", "suspended"];

// ── Inline action dropdown menu ─────────────────────────────────────────────

function ActionMenuItem({ icon: Icon, label, onClick, danger, muted }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left hover:bg-slate-50 ${
        danger ? "text-red-500" : muted ? "text-slate-400" : "text-slate-700"
      }`}
    >
      <Icon size={12} className="flex-shrink-0" />
      {label}
    </button>
  );
}

function ActionMenu({ user, onImpersonate, onVerify, onSuspend, onPenalty, onWallet, onFlag, onAssignPlan, onExtendExpiry, onResetPassword, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const act = (fn) => { setOpen(false); fn(); };

  return (
    <div ref={ref} className="relative">
      <button
        data-testid={`action-menu-${user.id}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={loading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <MoreHorizontal size={13} />}
        Actions
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
          {/* View */}
          <ActionMenuItem
            icon={Eye}
            label="View Profile"
            onClick={() => act(() => navigate(`/admin/users/${user.id}`))}
          />

          <div className="h-px bg-slate-100 my-1" />

          {/* Impersonate */}
          <ActionMenuItem
            icon={Zap}
            label="Impersonate"
            onClick={() => act(onImpersonate)}
          />

          {/* Verify */}
          <ActionMenuItem
            icon={user.is_verified ? Shield : ShieldCheck}
            label={user.is_verified ? "Remove Verification" : "Mark as Verified"}
            onClick={() => act(onVerify)}
          />

          {/* Suspend */}
          <ActionMenuItem
            icon={user.is_suspended ? CheckCircle : Ban}
            label={user.is_suspended ? "Unsuspend" : "Suspend"}
            onClick={() => act(onSuspend)}
            danger={!user.is_suspended}
          />

          {/* Reset Password */}
          <ActionMenuItem
            icon={KeyRound}
            label="Reset Password"
            onClick={() => act(onResetPassword)}
          />

          <div className="h-px bg-slate-100 my-1" />

          {/* Penalty */}
          <ActionMenuItem
            icon={AlertTriangle}
            label="Apply Penalty"
            onClick={() => act(onPenalty)}
            danger
          />

          {/* Wallet */}
          <ActionMenuItem
            icon={Wallet}
            label="Wallet Adjust"
            onClick={() => act(onWallet)}
          />

          {/* Assign Plan */}
          <ActionMenuItem
            icon={CreditCard}
            label="Assign Plan"
            onClick={() => act(onAssignPlan)}
          />

          {/* Extend Expiry */}
          <ActionMenuItem
            icon={CalendarClock}
            label="Extend Expiry"
            onClick={() => act(onExtendExpiry)}
          />

          <div className="h-px bg-slate-100 my-1" />

          {/* Featured */}
          <ActionMenuItem
            icon={Star}
            label={user.is_featured ? "Remove Featured" : "Set as Featured"}
            onClick={() => act(() => onFlag("is_featured", !user.is_featured))}
            muted={user.is_featured}
          />

          {/* High Risk */}
          <ActionMenuItem
            icon={Flag}
            label={user.is_high_risk ? "Remove High Risk" : "Mark High Risk"}
            onClick={() => act(() => onFlag("is_high_risk", !user.is_high_risk))}
            danger={!user.is_high_risk}
            muted={user.is_high_risk}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminUsers() {
  const { api, startImpersonation } = useAuth();
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

  // Per-row action loading
  const [actionLoading, setActionLoading] = useState({});

  // Penalty modal
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyData, setPenaltyData] = useState({ userId: "", reason: "", stars: 1 });

  // Wallet modal
  const [showWallet, setShowWallet] = useState(false);
  const [walletUserId, setWalletUserId] = useState(null);
  const [walletForm, setWalletForm] = useState({ amount: "", type: "credit", reason: "" });
  const [walletLoading, setWalletLoading] = useState(false);

  // Assign Plan modal
  const [showAssignPlan, setShowAssignPlan] = useState(false);
  const [assignPlanUserId, setAssignPlanUserId] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Extend Expiry modal
  const [showExtendExpiry, setShowExtendExpiry] = useState(false);
  const [extendExpiryUserId, setExtendExpiryUserId] = useState(null);
  const [extendDays, setExtendDays] = useState("30");
  const [extendLoading, setExtendLoading] = useState(false);

  // Reset Password modal
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState(null); // { user, tempPassword }
  const [resetPasswordConfirmUser, setResetPasswordConfirmUser] = useState(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

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

  // Load available plans once
  useEffect(() => {
    api.get("/plans").then(r => setAvailablePlans(r.data.plans || [])).catch(() => {});
  }, [api]);

  const clearFilters = () => {
    setSearch(""); setRole(""); setCity(""); setPlan("");
    setStatus(""); setMinRating(""); setMaxRating("");
  };
  const hasFilters = search || role || city || plan || status || minRating || maxRating;

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () =>
    setSelected(selected.size === users.length && users.length > 0 ? new Set() : new Set(users.map(u => u.id)));

  // ── Per-row actions ──────────────────────────────────────────────────────

  const withLoading = (userId, fn) => async () => {
    setActionLoading(l => ({ ...l, [userId]: true }));
    try { await fn(); } finally { setActionLoading(l => ({ ...l, [userId]: false })); }
  };

  const handleImpersonateUser = (userId, name) => withLoading(userId, async () => {
    const r = await api.post(`/admin/impersonate/${userId}`);
    const impersonatedUser = await startImpersonation(r.data.token);
    navigate("/dashboard");
    toast.success(`Now viewing as ${impersonatedUser?.full_name || name}`);
  })();

  const handleVerifyUser = (userId, isVerified) => withLoading(userId, async () => {
    await api.post("/admin/users/bulk-action", {
      action: isVerified ? "unverify" : "verify",
      user_ids: [userId],
    });
    toast.success(isVerified ? "Verification removed" : "User verified");
    load();
  })();

  const handleToggleSuspend = (userId) => withLoading(userId, async () => {
    const r = await api.put(`/admin/suspend/${userId}`);
    toast.success(r.data.is_suspended ? "User suspended" : "User unsuspended");
    load();
  })();

  const handleFlagUser = (userId, field, value) => withLoading(userId, async () => {
    await api.put(`/admin/users/${userId}/flags`, { [field]: value });
    toast.success("Updated");
    load();
  })();

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

  const handleWalletAdjust = async () => {
    if (!walletForm.amount || parseFloat(walletForm.amount) <= 0) {
      toast.error("Enter a valid amount"); return;
    }
    if (!walletForm.reason.trim()) { toast.error("Reason is required"); return; }
    setWalletLoading(true);
    try {
      const r = await api.post(`/admin/wallet/${walletUserId}/adjust`, {
        amount: parseFloat(walletForm.amount),
        type: walletForm.type,
        reason: walletForm.reason,
      });
      toast.success(`Done. New balance: ₹${r.data.new_balance.toFixed(2)}`);
      setShowWallet(false);
      setWalletForm({ amount: "", type: "credit", reason: "" });
      setWalletUserId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Wallet adjustment failed");
    } finally { setWalletLoading(false); }
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkAction = async (action) => {
    if (action === "notify" && (!notifyForm.title || !notifyForm.message)) {
      toast.error("Title and message required"); return;
    }
    setBulkLoading(true);
    try {
      const body = { action, user_ids: Array.from(selected) };
      if (action === "notify") { body.title = notifyForm.title; body.message = notifyForm.message; }
      const r = await api.post("/admin/users/bulk-action", body);
      toast.success(`${r.data.updated} user(s) updated`);
      setShowNotifyModal(false);
      setNotifyForm({ title: "", message: "" });
      load();
    } catch { toast.error("Bulk action failed"); }
    finally { setBulkLoading(false); }
  };

  const inputCls = "rounded-xl px-3 py-2 text-sm text-slate-900 border border-slate-200 focus:outline-none focus:border-blue-400 transition-colors bg-white";
  const selectCls = `${inputCls} appearance-none`;
  const walletUser = users.find(u => u.id === walletUserId);

  // Assign Plan handler
  const handleAssignPlan = async () => {
    if (!selectedPlanId) { toast.error("Select a plan"); return; }
    setAssignLoading(true);
    try {
      const r = await api.post(`/admin/users/${assignPlanUserId}/assign-plan`, { plan_id: selectedPlanId });
      toast.success(r.data.message);
      setShowAssignPlan(false);
      setSelectedPlanId("");
      setAssignPlanUserId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to assign plan");
    } finally { setAssignLoading(false); }
  };

  // Extend Expiry handler
  const handleExtendExpiry = async () => {
    const days = parseInt(extendDays);
    if (!days || days <= 0) { toast.error("Enter valid number of days"); return; }
    setExtendLoading(true);
    try {
      const r = await api.post(`/admin/users/${extendExpiryUserId}/extend-expiry`, { days });
      toast.success(r.data.message);
      setShowExtendExpiry(false);
      setExtendDays("30");
      setExtendExpiryUserId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to extend expiry");
    } finally { setExtendLoading(false); }
  };

  // Reset Password handler
  const handleResetPasswordConfirm = async () => {
    if (!resetPasswordConfirmUser) return;
    setResetPasswordLoading(true);
    try {
      const r = await api.post(`/admin/users/${resetPasswordConfirmUser.id}/reset-password`);
      setResetPasswordResult({ user: resetPasswordConfirmUser, tempPassword: r.data.temporary_password });
      toast.success("Temporary password generated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to reset password");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const closeResetPasswordModal = () => {
    setShowResetPassword(false);
    setResetPasswordConfirmUser(null);
    setResetPasswordResult(null);
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-24">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 font-display">Users</h1>
            <p className="text-slate-500 text-sm mt-1">{total} registered users</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
          <Filter size={14} className="text-slate-400 flex-shrink-0" />
          <select className={`${selectCls} text-xs`} value={plan} onChange={e => setPlan(e.target.value)}>
            <option value="">All Plans</option>
            {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={`${selectCls} text-xs`} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className={`${inputCls} text-xs w-28`} placeholder="Role…" value={role} onChange={e => setRole(e.target.value)} />
          <input className={`${inputCls} text-xs w-28`} placeholder="City…" value={city} onChange={e => setCity(e.target.value)} />
          <input type="number" min="0" max="5" step="0.1" className={`${inputCls} text-xs w-20`} placeholder="Min ★" value={minRating} onChange={e => setMinRating(e.target.value)} />
          <input type="number" min="0" max="5" step="0.1" className={`${inputCls} text-xs w-20`} placeholder="Max ★" value={maxRating} onChange={e => setMaxRating(e.target.value)} />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
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
            {users.length > 0 && (
              <div className="flex items-center gap-3 px-2 pb-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-500"
                  checked={selected.size === users.length && users.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs text-slate-400">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </div>
            )}

            {users.map(u => (
              <div
                key={u.id}
                data-testid={`user-row-${u.id}`}
                className="flex items-center justify-between p-4 rounded-2xl border transition-colors"
                style={{
                  background: selected.has(u.id) ? "rgba(59,130,246,0.04)" : "#FFFFFF",
                  borderColor: selected.has(u.id) ? "rgba(59,130,246,0.3)" : "#E2E8F0",
                }}
              >
                {/* Left: checkbox + avatar + info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-500 flex-shrink-0"
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold font-display cursor-pointer"
                    style={{ background: "#EFF6FF", color: "#1D4ED8" }}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm text-slate-900 font-display font-medium truncate cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      {u.full_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {u.email} · {u.primary_role || "No role"}
                      {u.location && ` · ${u.location}`}
                      {u.avg_rating && ` · ★ ${u.avg_rating.toFixed(1)}`}
                    </p>
                  </div>
                </div>

                {/* Right: status badges + actions */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {/* Status badges */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-display ${
                      u.is_verified ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-500"
                    }`}>
                      {u.is_verified ? "Verified" : u.verification_status}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-display ${
                      u.subscription_plan && u.subscription_plan !== "free" ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-slate-100 text-slate-400"
                    }`}>
                      {u.active_plan_name || (u.subscription_plan !== "free" ? u.subscription_plan : "Free")}
                    </span>
                    {u.is_suspended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 font-display">
                        Suspended
                      </span>
                    )}
                    {u.is_featured && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-display">
                        Featured
                      </span>
                    )}
                    {u.is_high_risk && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200 font-display">
                        High Risk
                      </span>
                    )}
                  </div>

                  {/* Actions dropdown */}
                  <ActionMenu
                    user={u}
                    loading={actionLoading[u.id]}
                    onImpersonate={() => handleImpersonateUser(u.id, u.full_name)}
                    onVerify={() => handleVerifyUser(u.id, u.is_verified)}
                    onSuspend={() => handleToggleSuspend(u.id)}
                    onPenalty={() => { setPenaltyData(p => ({ ...p, userId: u.id })); setShowPenalty(true); }}
                    onWallet={() => { setWalletUserId(u.id); setShowWallet(true); }}
                    onAssignPlan={() => { setAssignPlanUserId(u.id); setSelectedPlanId(""); setShowAssignPlan(true); }}
                    onExtendExpiry={() => { setExtendExpiryUserId(u.id); setExtendDays("30"); setShowExtendExpiry(true); }}
                    onResetPassword={() => { setResetPasswordConfirmUser(u); setResetPasswordResult(null); setShowResetPassword(true); }}
                    onFlag={(field, val) => handleFlagUser(u.id, field, val)}
                  />
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Users size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk action toolbar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 shadow-2xl z-40 bg-white">
          <span className="text-sm text-slate-700 font-display">{selected.size} selected</span>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={() => handleBulkAction("suspend")} disabled={bulkLoading} className="text-xs px-3 py-1.5 rounded-lg text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-60">Suspend</button>
          <button onClick={() => handleBulkAction("unsuspend")} disabled={bulkLoading} className="text-xs px-3 py-1.5 rounded-lg text-emerald-600 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-60">Unsuspend</button>
          <button onClick={() => handleBulkAction("verify")} disabled={bulkLoading} className="text-xs px-3 py-1.5 rounded-lg text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-60">Verify</button>
          <button onClick={() => setShowNotifyModal(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-orange-500 border border-orange-200 hover:bg-orange-50">
            <Send size={11} /> Notify
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600">Clear</button>
        </div>
      )}

      {/* ── Penalty Modal ── */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" /> Apply Penalty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Stars to deduct</label>
              <select className={`w-full ${inputCls}`} value={penaltyData.stars} onChange={e => setPenaltyData(p => ({ ...p, stars: parseInt(e.target.value) }))}>
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Reason *</label>
              <textarea className={`w-full ${inputCls} resize-none h-20`} placeholder="Explain the penalty reason…" value={penaltyData.reason} onChange={e => setPenaltyData(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPenalty(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button data-testid="apply-penalty-btn" onClick={handlePenalty} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ background: "#EA580C" }}>Apply Penalty</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Wallet Adjust Modal ── */}
      <Dialog open={showWallet} onOpenChange={() => { setShowWallet(false); setWalletUserId(null); }}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <Wallet size={16} className="text-blue-500" /> Wallet Adjustment
              {walletUser && <span className="text-xs font-normal text-slate-500 ml-1">— {walletUser.full_name}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Amount (₹) *</label>
                <input type="number" min="0.01" step="0.01" className={inputCls} placeholder="0.00" value={walletForm.amount} onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Type *</label>
                <select className={`${inputCls} appearance-none`} value={walletForm.type} onChange={e => setWalletForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (−)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Reason *</label>
              <textarea className={`w-full ${inputCls} resize-none h-20`} placeholder="Reason for adjustment…" value={walletForm.reason} onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowWallet(false); setWalletUserId(null); }} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={handleWalletAdjust} disabled={walletLoading} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: "#1D4ED8" }}>
                {walletLoading ? "Saving…" : `${walletForm.type === "credit" ? "Credit" : "Debit"} ₹${walletForm.amount || "0"}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Notify Modal ── */}
      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <Send size={16} className="text-orange-500" /> Notify {selected.size} Users
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Title *</label>
              <input className={inputCls} placeholder="Notification title…" value={notifyForm.title} onChange={e => setNotifyForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Message *</label>
              <textarea className={`w-full ${inputCls} resize-none h-24`} placeholder="Your message…" value={notifyForm.message} onChange={e => setNotifyForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowNotifyModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleBulkAction("notify")} disabled={bulkLoading} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: "#D97706" }}>
                {bulkLoading ? "Sending…" : "Send Notification"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assign Plan Modal ── */}
      <Dialog open={showAssignPlan} onOpenChange={v => { setShowAssignPlan(v); if (!v) { setAssignPlanUserId(null); setSelectedPlanId(""); } }}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <CreditCard size={15} className="text-blue-500" /> Assign Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-500">Directly assign a subscription plan to this user. No payment required.</p>
            {availablePlans.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No active plans found. Create plans first from Admin → Plans.</p>
            ) : (
              <div className="space-y-2">
                {availablePlans.map(p => (
                  <button
                    key={p.id}
                    data-testid={`assign-plan-option-${p.id}`}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${selectedPlanId === p.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div>
                      <p className="text-sm font-display font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">₹{p.price}/{p.validity === "yearly" ? "yr" : "mo"}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {p.features?.public_gig_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-display">Gig Board</span>}
                      {p.features?.whatsapp_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-display">WhatsApp</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowAssignPlan(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button
                data-testid="confirm-assign-plan-btn"
                onClick={handleAssignPlan}
                disabled={assignLoading || !selectedPlanId}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#1D4ED8" }}
              >
                {assignLoading ? "Assigning…" : "Assign Plan"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Extend Expiry Modal ── */}
      <Dialog open={showExtendExpiry} onOpenChange={v => { setShowExtendExpiry(v); if (!v) { setExtendExpiryUserId(null); setExtendDays("30"); } }}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <CalendarClock size={15} className="text-emerald-500" /> Extend Plan Expiry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-500">Extend the user's current plan expiry. If already expired, extension starts from today.</p>
            <div className="grid grid-cols-4 gap-2">
              {["7", "14", "30", "90"].map(d => (
                <button
                  key={d}
                  data-testid={`extend-days-${d}`}
                  onClick={() => setExtendDays(d)}
                  className={`py-2 rounded-xl text-sm font-display border transition-all ${extendDays === d ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Or enter custom days</label>
              <input
                data-testid="extend-days-custom-input"
                type="number"
                min="1"
                className={inputCls + " w-full"}
                value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowExtendExpiry(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button
                data-testid="confirm-extend-expiry-btn"
                onClick={handleExtendExpiry}
                disabled={extendLoading || !extendDays || parseInt(extendDays) <= 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#059669" }}
              >
                {extendLoading ? "Extending…" : `Extend by ${extendDays || "?"} days`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Modal ── */}
      <Dialog open={showResetPassword} onOpenChange={v => { if (!v) closeResetPasswordModal(); }}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <KeyRound size={15} className="text-orange-500" /> Reset Password
              {resetPasswordConfirmUser && <span className="text-xs font-normal text-slate-500 ml-1">— {resetPasswordConfirmUser.full_name}</span>}
            </DialogTitle>
          </DialogHeader>

          {!resetPasswordResult ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-slate-600">
                This will generate a new random <strong>temporary password</strong> for{" "}
                <span className="font-medium text-slate-900">{resetPasswordConfirmUser?.email}</span>.
                Their current password will stop working immediately, and they will be required to set a new
                password the next time they log in.
              </p>
              <div className="flex gap-3">
                <button onClick={closeResetPasswordModal} className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
                <button
                  data-testid="confirm-reset-password-btn"
                  onClick={handleResetPasswordConfirm}
                  disabled={resetPasswordLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "#EA580C" }}
                >
                  {resetPasswordLoading ? "Generating…" : "Generate Temporary Password"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-700">
                  Password reset! Share this temporary password with the user securely (it will not be shown again). They must change it after logging in.
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Temporary Password</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    data-testid="temp-password-value"
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm font-mono outline-none select-all"
                    value={resetPasswordResult.tempPassword}
                  />
                  <button
                    data-testid="copy-temp-password-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordResult.tempPassword);
                      toast.success("Temporary password copied!");
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>
              <button
                data-testid="reset-password-done-btn"
                onClick={closeResetPasswordModal}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: "#1D4ED8" }}
              >
                Done
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
