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
          <h1 className="text-4xl font-bold text-slate-900 font-display">Verification Queue</h1>
          <p className="text-slate-500 text-sm mt-1">{queue.length} user{queue.length !== 1 ? "s" : ""} awaiting review</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-20">
            <Shield size={40} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Queue is empty — all users verified!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map(u => (
              <div
                key={u.id}
                data-testid={`verify-card-${u.id}`}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-semibold text-slate-900 font-display">{u.full_name}</p>
                      {u.id_type && (
                        <span className="text-xs px-2 py-0.5 rounded text-amber-600 bg-amber-50 border border-amber-200">
                          {u.id_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{u.email} · {u.phone} · {u.location}</p>
                    {u.primary_role && (
                      <p className="text-xs text-blue-600 mt-0.5 font-display">{u.primary_role}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      data-testid={`view-docs-${u.id}`}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
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
            className="max-w-xl bg-white border-slate-200"
          >
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-display">
                ID Documents — {selectedUser.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                {selectedUser.govt_id_url && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Government ID ({selectedUser.id_type})</p>
                    <img
                      src={selectedUser.govt_id_url}
                      alt="Govt ID"
                      className="w-full rounded-xl border border-slate-200 object-contain max-h-48"
                    />
                  </div>
                )}
                {selectedUser.selfie_url && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Selfie</p>
                    <img
                      src={selectedUser.selfie_url}
                      alt="Selfie"
                      className="w-full rounded-xl border border-slate-200 object-contain max-h-48"
                    />
                  </div>
                )}
                {!selectedUser.govt_id_url && !selectedUser.selfie_url && (
                  <div className="col-span-2 text-center py-8 text-slate-400 text-sm">
                    No documents uploaded yet
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Rejection Reason (if rejecting)</label>
                <textarea
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 border border-slate-200 resize-none h-16 focus:outline-none focus:border-blue-400 bg-slate-50"
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
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors"
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
