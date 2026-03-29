import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Zap, Ban, CheckCircle, AlertTriangle,
  Star, Wallet, Shield, Monitor, Briefcase, Clock, UserCheck, Flag
} from "lucide-react";
import { toast } from "sonner";

export default function AdminUserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Wallet adjust modal
  const [showWallet, setShowWallet] = useState(false);
  const [walletForm, setWalletForm] = useState({ amount: "", type: "credit", reason: "" });
  const [walletLoading, setWalletLoading] = useState(false);

  // Penalty modal
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState({ reason: "", stars: 1 });
  const [penaltyLoading, setPenaltyLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/users/${id}/profile`);
      setProfile(r.data);
    } catch {
      toast.error("Failed to load user profile");
      navigate("/admin/users");
    } finally {
      setLoading(false);
    }
  }, [api, id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async () => {
    try {
      const r = await api.post(`/admin/impersonate/${id}`);
      const baseUrl = window.location.origin;
      window.open(`${baseUrl}/dashboard?impersonate_token=${r.data.token}`, "_blank");
      toast.success("Opened user session in new tab (1-hour token)");
    } catch {
      toast.error("Impersonation failed");
    }
  };

  const handleToggleSuspend = async () => {
    setActionLoading(true);
    try {
      const r = await api.put(`/admin/suspend/${id}`);
      toast.success(r.data.is_suspended ? "User suspended" : "User unsuspended");
      load();
    } catch { toast.error("Failed"); }
    finally { setActionLoading(false); }
  };

  const handleFlag = async (field, value) => {
    try {
      await api.put(`/admin/users/${id}/flags`, { [field]: value });
      toast.success("Flag updated");
      load();
    } catch { toast.error("Failed to update flag"); }
  };

  const handleWalletAdjust = async () => {
    if (!walletForm.amount || parseFloat(walletForm.amount) <= 0) {
      toast.error("Enter a valid amount"); return;
    }
    if (!walletForm.reason.trim()) { toast.error("Reason is required"); return; }
    setWalletLoading(true);
    try {
      const r = await api.post(`/admin/wallet/${id}/adjust`, {
        amount: parseFloat(walletForm.amount),
        type: walletForm.type,
        reason: walletForm.reason,
      });
      toast.success(`Wallet updated. New balance: ₹${r.data.new_balance.toFixed(2)}`);
      setShowWallet(false);
      setWalletForm({ amount: "", type: "credit", reason: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Wallet adjustment failed");
    } finally { setWalletLoading(false); }
  };

  const handlePenalty = async () => {
    if (!penaltyForm.reason) { toast.error("Enter a reason"); return; }
    setPenaltyLoading(true);
    try {
      await api.post(`/admin/penalty/${id}`, {
        reason: penaltyForm.reason,
        stars: penaltyForm.stars,
      });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyForm({ reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
    finally { setPenaltyLoading(false); }
  };

  const cardCls = "p-4 rounded-2xl border border-slate-200 bg-white shadow-sm";
  const cardStyle = {};
  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 border border-slate-200 focus:outline-none focus:border-blue-400 bg-white";
  const inputStyle = {};

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) return null;
  const { user, gigs, invites, wallet_transactions, wallet_adjustments, ratings, login_logs } = profile;

  // Merge wallet transactions + adjustments into one timeline
  const walletTimeline = [
    ...wallet_transactions.map(t => ({ ...t, _source: "txn" })),
    ...wallet_adjustments.map(a => ({ ...a, _source: "adj" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back + header */}
        <div>
          <button
            onClick={() => navigate("/admin/users")}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Back to Users
          </button>

          <div className={`${cardCls} flex flex-col sm:flex-row items-start sm:items-center gap-4`} style={cardStyle}>
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold font-display flex-shrink-0"
              style={{ background: "#1D4ED815", color: "#1D4ED8" }}
            >
              {user.full_name?.[0]?.toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900 font-display">{user.full_name}</h1>
                {user.is_verified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Verified</span>}
                {user.is_suspended && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Suspended</span>}
                {user.is_featured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Featured</span>}
                {user.is_high_risk && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">High Risk</span>}
              </div>
              <p className="text-xs text-slate-500">{user.email} · {user.phone} · {user.location}</p>
              <p className="text-xs text-slate-400 mt-0.5">{user.primary_role || "No role"} · {user.subscription_plan} plan</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={handleImpersonate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#1D4ED8" }}
              >
                <Zap size={12} /> Impersonate
              </button>
              <button
                onClick={handleToggleSuspend}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-colors disabled:opacity-60 ${
                  user.is_suspended
                    ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    : "text-red-400 border-red-500/30 hover:bg-red-500/10"
                }`}
              >
                {user.is_suspended ? <CheckCircle size={12} /> : <Ban size={12} />}
                {user.is_suspended ? "Unsuspend" : "Suspend"}
              </button>
              <button
                onClick={() => setShowPenalty(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 transition-colors"
              >
                <AlertTriangle size={12} /> Penalty
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="border border-slate-200 bg-slate-100" style={{}}>
            {[
              { value: "overview", label: "Overview", icon: UserCheck },
              { value: "gigs", label: `Gigs (${gigs.length})`, icon: Briefcase },
              { value: "wallet", label: "Wallet", icon: Wallet },
              { value: "ratings", label: `Ratings (${ratings.length})`, icon: Star },
              { value: "logins", label: "Login History", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-display text-xs gap-1.5 text-slate-500"
              >
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className={cardCls} style={cardStyle}>
              <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Profile Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["ID", user.id],
                  ["Email", user.email],
                  ["Phone", user.phone],
                  ["Location", user.location],
                  ["Pincode", user.pincode],
                  ["Plan", user.subscription_plan],
                  ["Primary Role", user.primary_role || "—"],
                  ["Avg Rating", user.avg_rating ? `★ ${user.avg_rating.toFixed(2)}` : "—"],
                  ["Negative Stars", user.negative_stars ?? 0],
                  ["Wallet Balance", `₹${(user.wallet_balance || 0).toFixed(2)}`],
                  ["Joined", fmt(user.created_at)],
                  ["Referral Code", user.referral_code || "—"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 font-display uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-slate-700 mt-0.5 truncate">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardCls} style={cardStyle}>
              <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Role Overrides</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => handleFlag("is_featured", !user.is_featured)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      user.is_featured ? "bg-amber-500" : "bg-slate-200"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                      user.is_featured ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-slate-700 font-display">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => handleFlag("is_high_risk", !user.is_high_risk)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      user.is_high_risk ? "bg-rose-500" : "bg-slate-200"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                      user.is_high_risk ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-slate-700 font-display">High Risk</span>
                </label>
              </div>
            </div>

            <div className={cardCls} style={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900 font-display">Wallet Balance</h3>
                <button
                  onClick={() => setShowWallet(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: "#1D4ED8" }}
                >
                  <Wallet size={11} /> Credit / Debit
                </button>
              </div>
              <p className="text-3xl font-bold text-slate-900 font-display">
                ₹{(user.wallet_balance || 0).toFixed(2)}
              </p>
            </div>
          </TabsContent>

          {/* Gigs Tab */}
          <TabsContent value="gigs" className="mt-4">
            {gigs.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Briefcase size={32} className="mx-auto mb-3 text-slate-300 opacity-40" />
                <p className="text-sm">No gigs created</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gigs.map(g => (
                  <div key={g.id} className={`${cardCls} flex items-center justify-between`} style={cardStyle}>
                    <div>
                      <p className="text-sm text-slate-900 font-display font-medium">{g.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{fmt(g.created_at)}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                      {g.status || "draft"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">{walletTimeline.length} transactions</p>
              <button
                onClick={() => setShowWallet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: "#1D4ED8" }}
              >
                <Wallet size={11} /> Add Credit / Debit
              </button>
            </div>
            {walletTimeline.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Wallet size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {walletTimeline.map((t, i) => (
                  <div key={t.id || i} className={`${cardCls} flex items-center justify-between`} style={cardStyle}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-900 font-display font-medium">
                          {t.description || t.reason || t.type}
                        </p>
                        {t._source === "adj" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-display">Admin</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{fmt(t.created_at)}</p>
                    </div>
                    <p className={`text-sm font-semibold font-display ${
                      t.type === "credit" || t.type === "admin_credit" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {(t.type === "credit" || t.type === "admin_credit") ? "+" : "−"}₹{(t.amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ratings Tab */}
          <TabsContent value="ratings" className="mt-4">
            {ratings.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Star size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No ratings received</p>
              </div>
            ) : (
              <>
                {user.avg_rating && (
                  <div className={`${cardCls} flex items-center gap-3 mb-3`} style={cardStyle}>
                    <Star size={18} className="text-amber-400" />
                    <p className="text-2xl font-bold text-white font-display">{user.avg_rating.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">avg across {ratings.length} ratings</p>
                  </div>
                )}
                <div className="space-y-2">
                  {ratings.map((r, i) => {
                    const avg = ((r.punctuality + r.gear_handling + r.teamwork) / 3).toFixed(1);
                    return (
                      <div key={r.id || i} className={cardCls} style={cardStyle}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-zinc-400">{fmt(r.created_at)}</p>
                          <span className="text-xs text-amber-400 font-display">★ {avg}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-zinc-500">
                          <span>Punctuality: {r.punctuality}/5</span>
                          <span>Gear: {r.gear_handling}/5</span>
                          <span>Teamwork: {r.teamwork}/5</span>
                        </div>
                        {r.notes && <p className="text-xs text-zinc-400 mt-1 italic">"{r.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Login History Tab */}
          <TabsContent value="logins" className="mt-4">
            {login_logs.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Monitor size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No login history recorded</p>
                <p className="text-xs text-zinc-700 mt-1">Login tracking started from this deployment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {login_logs.map((l, i) => (
                  <div key={l.id || i} className={`${cardCls} flex items-start justify-between`} style={cardStyle}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 font-display font-medium">{l.ip}</p>
                      <p className="text-[10px] text-zinc-600 truncate mt-0.5">{l.user_agent}</p>
                    </div>
                    <p className="text-[10px] text-zinc-500 flex-shrink-0 ml-4">{fmt(l.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Wallet Adjust Modal */}
      <Dialog open={showWallet} onOpenChange={setShowWallet}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <Wallet size={16} className="text-blue-500" /> Wallet Adjustment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="0.00"
                  value={walletForm.amount}
                  onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Type *</label>
                <select
                  className={`${inputCls} appearance-none`}
                  style={{ background: "#ffffff" }}
                  value={walletForm.type}
                  onChange={e => setWalletForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (−)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason *</label>
              <textarea
                className={`${inputCls} resize-none h-20`}
                style={inputStyle}
                placeholder="Reason for adjustment (support credit, correction…)"
                value={walletForm.reason}
                onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWallet(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWalletAdjust}
                disabled={walletLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#1D4ED8" }}
              >
                {walletLoading ? "Saving…" : `${walletForm.type === "credit" ? "Credit" : "Debit"} ₹${walletForm.amount || "0"}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Penalty Modal */}
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
              <select
                className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 border border-slate-200 focus:outline-none bg-white"
                value={penaltyForm.stars}
                onChange={e => setPenaltyForm(f => ({ ...f, stars: parseInt(e.target.value) }))}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Reason *</label>
              <textarea
                className={`${inputCls} resize-none h-20`}
                placeholder="Explain the penalty reason…"
                value={penaltyForm.reason}
                onChange={e => setPenaltyForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPenalty(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePenalty}
                disabled={penaltyLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#EA580C" }}
              >
                {penaltyLoading ? "Applying…" : "Apply Penalty"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
