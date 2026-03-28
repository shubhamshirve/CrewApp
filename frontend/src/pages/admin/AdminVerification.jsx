import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Shield, Check, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminVerification() {
  const { api } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/verification-queue");
      setQueue(r.data);
    } catch { toast.error("Failed to load queue"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (userId, action) => {
    setActionLoading(true);
    try {
      await api.put(`/admin/verify/${userId}`, {
        action,
        reason: action === "rejected" ? rejectReason : undefined,
      });
      toast.success(`User ${action}`);
      setSelectedUser(null);
      setRejectReason("");
      load();
    } catch { toast.error("Action failed"); }
    finally { setActionLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-white font-display">Verification Queue</h1>
          <p className="text-zinc-500 text-sm mt-1">{queue.length} user{queue.length !== 1 ? "s" : ""} awaiting review</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-20">
            <Shield size={40} className="text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">Queue is empty — all users verified!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map(u => (
              <div
                key={u.id}
                data-testid={`verify-card-${u.id}`}
                className="p-5 rounded-2xl border"
                style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-semibold text-white font-display">{u.full_name}</p>
                      {u.id_type && (
                        <span className="text-xs px-2 py-0.5 rounded text-amber-400 bg-amber-400/10">
                          {u.id_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">{u.email} · {u.phone} · {u.location}</p>
                    {u.primary_role && (
                      <p className="text-xs text-blue-400 mt-0.5 font-display">{u.primary_role}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      data-testid={`view-docs-${u.id}`}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-300 border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <Eye size={12} /> View Docs
                    </button>
                    <button
                      data-testid={`approve-${u.id}`}
                      onClick={() => handleVerify(u.id, "approved")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white font-medium transition-opacity hover:opacity-90"
                      style={{ background: "#10B981" }}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      data-testid={`reject-${u.id}`}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Docs Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => { setSelectedUser(null); setRejectReason(""); }}>
          <DialogContent
            className="max-w-xl"
            style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}
          >
            <DialogHeader>
              <DialogTitle className="text-white font-display">
                ID Documents — {selectedUser.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                {selectedUser.govt_id_url && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Government ID ({selectedUser.id_type})</p>
                    <img
                      src={selectedUser.govt_id_url}
                      alt="Govt ID"
                      className="w-full rounded-xl border border-white/10 object-contain max-h-48"
                    />
                  </div>
                )}
                {selectedUser.selfie_url && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Selfie</p>
                    <img
                      src={selectedUser.selfie_url}
                      alt="Selfie"
                      className="w-full rounded-xl border border-white/10 object-contain max-h-48"
                    />
                  </div>
                )}
                {!selectedUser.govt_id_url && !selectedUser.selfie_url && (
                  <div className="col-span-2 text-center py-8 text-zinc-600 text-sm">
                    No documents uploaded yet
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Rejection Reason (if rejecting)</label>
                <textarea
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 resize-none h-16 focus:outline-none focus:border-blue-500/50"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  placeholder="Optional — explain why..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  data-testid="dialog-approve-btn"
                  onClick={() => handleVerify(selectedUser.id, "approved")}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: "#10B981" }}
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
                <button
                  data-testid="dialog-reject-btn"
                  onClick={() => handleVerify(selectedUser.id, "rejected")}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
