import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Users, AlertTriangle, Ban, CheckCircle, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminUsers() {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [penaltyData, setPenaltyData] = useState({ userId: "", reason: "", stars: 1 });
  const [showPenalty, setShowPenalty] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/users");
      setUsers(r.data.users);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
        reason: penaltyData.reason,
        stars: penaltyData.stars,
      });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyData({ userId: "", reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
  };

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white font-display">Users</h1>
            <p className="text-zinc-500 text-sm mt-1">{users.length} registered users</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            data-testid="admin-user-search"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white border border-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div
                key={u.id}
                data-testid={`user-row-${u.id}`}
                className="flex items-center justify-between p-4 rounded-2xl border transition-colors"
                style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold font-display"
                    style={{ background: "#1D4ED820", color: "#3B82F6" }}
                  >
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-display font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{u.email} · {u.primary_role || "No role set"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.is_verified ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/50 text-zinc-400"
                  }`}>
                    {u.is_verified ? "Verified" : u.verification_status}
                  </span>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.subscription_plan !== "free" ? "bg-blue-500/15 text-blue-400" : "bg-zinc-700/30 text-zinc-600"
                  }`}>
                    {u.subscription_plan}
                  </span>
                  {u.is_suspended && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400">
                      Suspended
                    </span>
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

            {filtered.length === 0 && (
              <div className="text-center py-12 text-zinc-600">
                <Users size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Penalty Dialog */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" /> Apply Penalty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Stars to deduct</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 focus:outline-none"
                style={{ background: "#111827" }}
                value={penaltyData.stars}
                onChange={e => setPenaltyData(p => ({ ...p, stars: parseInt(e.target.value) }))}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason *</label>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 resize-none h-20 focus:outline-none focus:border-orange-500/50"
                style={{ background: "rgba(255,255,255,0.04)" }}
                placeholder="Explain the penalty reason…"
                value={penaltyData.reason}
                onChange={e => setPenaltyData(p => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPenalty(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
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
    </AdminLayout>
  );
}
