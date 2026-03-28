import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Check, X, Users, BarChart3, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminDashboard() {
  const { api } = useAuth();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [penaltyData, setPenaltyData] = useState({ userId: "", reason: "", stars: 1 });
  const [showPenalty, setShowPenalty] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [qRes, statsRes, userRes] = await Promise.all([
        api.get("/admin/verification-queue"),
        api.get("/admin/stats"),
        api.get("/admin/users"),
      ]);
      setQueue(qRes.data);
      setStats(statsRes.data);
      setUsers(userRes.data.users);
    } catch (err) { toast.error("Failed to load admin data"); } finally { setLoading(false); }
  };

  const handleVerify = async (userId, action) => {
    try {
      await api.put(`/admin/verify/${userId}`, { action, reason: action === "rejected" ? rejectReason : undefined });
      toast.success(`User ${action}`);
      setSelectedUser(null);
      setRejectReason("");
      load();
    } catch { toast.error("Failed"); }
  };

  const handlePenalty = async () => {
    if (!penaltyData.reason) { toast.error("Enter a reason"); return; }
    try {
      await api.post(`/admin/penalty/${penaltyData.userId}`, { reason: penaltyData.reason, stars: penaltyData.stars });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyData({ userId: "", reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
  };

  const handleToggleSuspend = async (userId) => {
    try {
      const res = await api.put(`/admin/suspend/${userId}`);
      toast.success(res.data.is_suspended ? "User suspended" : "User unsuspended");
      load();
    } catch { toast.error("Failed"); }
  };

  const StatCard = ({ label, value, color = "#F59E0B" }) => (
    <div data-testid={`admin-stat-${label.toLowerCase().replace(/ /g, "-")}`} className="bg-white border border-border rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 text-center">
      <p className="text-3xl font-bold font-display" style={{ color }}>{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground mt-1 font-display">{label}</p>
    </div>
  );

  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 rounded-xl";

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-primary" />
          <h1 className="text-2xl font-semibold text-foreground font-display">Admin Dashboard</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total Users" value={stats?.total_users} />
          <StatCard label="Verified" value={stats?.verified_users} color="#10B981" />
          <StatCard label="Pending Review" value={stats?.pending_verification} color="#F59E0B" />
          <StatCard label="Subscriptions" value={stats?.active_subscriptions} color="#3B82F6" />
          <StatCard label="Total Gigs" value={stats?.total_gigs} color="#8B5CF6" />
        </div>

        <Tabs defaultValue="verification">
          <TabsList className="bg-slate-100 border border-border">
            <TabsTrigger value="verification" data-testid="admin-tab-verification" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs">
              Verification Queue ({queue.length})
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="admin-tab-users" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs">
              Users
            </TabsTrigger>
          </TabsList>

          {/* Verification Queue */}
          <TabsContent value="verification" className="mt-4">
            {queue.length === 0 ? (
              <div className="text-center py-16">
                <Shield size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Queue is empty. All users verified!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map(u => (
                  <div key={u.id} data-testid={`verify-card-${u.id}`} className="bg-white border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-base font-semibold text-foreground font-display">{u.full_name}</p>
                          <span className="text-xs px-2 py-0.5 rounded font-display bg-primary/10 text-primary">{u.id_type || "ID"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email} · {u.phone} · {u.location}</p>
                        {u.primary_role && <p className="text-xs text-primary font-display mt-0.5">{u.primary_role}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" data-testid={`view-docs-${u.id}`} onClick={() => setSelectedUser(u)} variant="outline" className="border-border text-slate-600 gap-1 text-xs hover:text-foreground hover:bg-slate-50 rounded-full">
                          <Eye size={13} /> View Docs
                        </Button>
                        <Button size="sm" data-testid={`approve-${u.id}`} onClick={() => handleVerify(u.id, "approved")} className="gap-1 text-xs bg-emerald-500 text-white hover:bg-emerald-600 rounded-full">
                          <Check size={13} /> Approve
                        </Button>
                        <Button size="sm" data-testid={`reject-${u.id}`} onClick={() => { setSelectedUser(u); }} variant="outline" className="border-red-500/30 text-red-500 text-xs hover:bg-red-500/10 gap-1 rounded-full">
                          <X size={13} /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users List */}
          <TabsContent value="users" className="mt-4">
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} data-testid={`user-row-${u.id}`} className="flex items-center justify-between bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-display font-bold bg-primary/10 text-primary">
                      {u.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-display font-medium truncate">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email} · {u.primary_role || "No role"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-display ${u.is_verified ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {u.is_verified ? "Verified" : u.verification_status}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-display ${u.subscription_plan !== "free" ? "bg-amber-500/15 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                      {u.subscription_plan}
                    </span>
                    <Button size="sm" data-testid={`penalty-btn-${u.id}`} onClick={() => { setPenaltyData(p => ({ ...p, userId: u.id })); setShowPenalty(true); }} variant="outline" className="border-orange-500/20 text-orange-500 text-xs hover:bg-orange-500/5 gap-1 rounded-full">
                      <AlertTriangle size={11} /> Penalty
                    </Button>
                    <Button size="sm" data-testid={`suspend-btn-${u.id}`} onClick={() => handleToggleSuspend(u.id)} variant="outline" className={`text-xs gap-1 rounded-full ${u.is_suspended ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-500"}`}>
                      {u.is_suspended ? "Unsuspend" : "Suspend"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* View Docs Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => { setSelectedUser(null); setRejectReason(""); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-foreground font-display">ID Documents – {selectedUser.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                {selectedUser.govt_id_url && (
                  <div>
                    <p className="text-xs text-muted-foreground font-display mb-2">Government ID ({selectedUser.id_type})</p>
                    <img src={selectedUser.govt_id_url} alt="Government ID" className="w-full rounded-lg border border-border object-contain max-h-48" />
                  </div>
                )}
                {selectedUser.selfie_url && (
                  <div>
                    <p className="text-xs text-muted-foreground font-display mb-2">Selfie</p>
                    <img src={selectedUser.selfie_url} alt="Selfie" className="w-full rounded-lg border border-border object-contain max-h-48" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-display mb-1 block">Rejection Reason (if rejecting)</label>
                <textarea className={`w-full px-3 py-2 text-sm ${inputClass} border resize-none h-16`} placeholder="Optional: explain why..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button data-testid="dialog-approve-btn" onClick={() => handleVerify(selectedUser.id, "approved")} className="flex-1 gap-1 bg-emerald-500 text-white hover:bg-emerald-600 rounded-full">
                  <Check size={14} /> Approve
                </Button>
                <Button data-testid="dialog-reject-btn" onClick={() => handleVerify(selectedUser.id, "rejected")} variant="outline" className="flex-1 gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-full">
                  <X size={14} /> Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Penalty Dialog */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground font-display flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500" /> Apply Penalty</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-slate-600 text-sm font-display mb-1 block">Stars to deduct</label>
              <select className={`w-full px-3 py-2 text-sm ${inputClass} border`} value={penaltyData.stars} onChange={e => setPenaltyData(p => ({ ...p, stars: parseInt(e.target.value) }))}>
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (immediate suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-600 text-sm font-display mb-1 block">Reason *</label>
              <textarea className={`w-full px-3 py-2 text-sm ${inputClass} border resize-none h-20`} placeholder="Explain the penalty reason..." value={penaltyData.reason} onChange={e => setPenaltyData(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPenalty(false)} className="flex-1 border-border text-slate-600 rounded-full">Cancel</Button>
              <Button data-testid="apply-penalty-btn" onClick={handlePenalty} className="flex-1 font-display bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">Apply Penalty</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
