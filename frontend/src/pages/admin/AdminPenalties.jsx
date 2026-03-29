import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Loader2, CheckCircle, XCircle, Clock, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminPenalties() {
  const { api } = useAuth();
  const [penalties, setPenalties] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loadingPenalties, setLoadingPenalties] = useState(true);
  const [loadingAppeals, setLoadingAppeals] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(null); // { appeal, action }
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPenalties = useCallback(() => {
    setLoadingPenalties(true);
    api.get("/admin/penalties")
      .then(r => setPenalties(r.data?.items || []))
      .catch(() => setPenalties([]))
      .finally(() => setLoadingPenalties(false));
  }, [api]);

  const loadAppeals = useCallback(() => {
    setLoadingAppeals(true);
    api.get("/admin/appeals")
      .then(r => setAppeals(r.data || []))
      .catch(() => setAppeals([]))
      .finally(() => setLoadingAppeals(false));
  }, [api]);

  useEffect(() => {
    loadPenalties();
    loadAppeals();
  }, [loadPenalties, loadAppeals]);

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/appeals/${reviewDialog.appeal.id}`, {
        action: reviewDialog.action,
        admin_note: adminNote || undefined,
      });
      toast.success(`Appeal ${reviewDialog.action}d successfully`);
      setReviewDialog(null);
      setAdminNote("");
      loadAppeals();
    } catch {
      toast.error("Failed to process appeal");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingAppeals = appeals.filter(a => a.status === "pending");
  const resolvedAppeals = appeals.filter(a => a.status !== "pending");

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 font-display">Penalties & Appeals</h1>
          <p className="text-slate-500 text-sm mt-1">Manage platform penalties and review freelancer appeals</p>
        </div>

        <Tabs defaultValue="penalties">
          <TabsList className="bg-slate-100 border border-slate-200">
            <TabsTrigger value="penalties" className="font-display text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Penalty Log
            </TabsTrigger>
            <TabsTrigger value="appeals" data-testid="appeals-tab" className="font-display text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Appeals {pendingAppeals.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white font-bold">
                  {pendingAppeals.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Penalty Log */}
          <TabsContent value="penalties" className="mt-4">
            {loadingPenalties ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            ) : penalties.length === 0 ? (
              <div className="text-center py-20">
                <AlertTriangle size={40} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">No penalties recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {penalties.map((p, i) => (
                  <div
                    key={p.id || i}
                    data-testid={`penalty-row-${p.id || i}`}
                    className="flex items-start justify-between p-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 font-display">{p.user_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.reason}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {p.admin_email && <span className="ml-2">by {p.admin_email}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                        -{p.stars} star{p.stars !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-500 flex items-center gap-1">
                        <Star size={10} fill="currentColor" />{p.total_stars}/5
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Appeals */}
          <TabsContent value="appeals" className="mt-4">
            {loadingAppeals ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            ) : appeals.length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle size={40} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">No appeals filed yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingAppeals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 font-display mb-3">
                      Pending Review ({pendingAppeals.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingAppeals.map(ap => (
                        <AppealCard
                          key={ap.id}
                          appeal={ap}
                          onApprove={() => { setReviewDialog({ appeal: ap, action: "approve" }); setAdminNote(""); }}
                          onReject={() => { setReviewDialog({ appeal: ap, action: "reject" }); setAdminNote(""); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {resolvedAppeals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 font-display mb-3">
                      Resolved ({resolvedAppeals.length})
                    </h3>
                    <div className="space-y-3">
                      {resolvedAppeals.map(ap => (
                        <AppealCard key={ap.id} appeal={ap} resolved />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">
              {reviewDialog?.action === "approve" ? "Approve Appeal" : "Reject Appeal"}
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm font-semibold text-slate-800 font-display">{reviewDialog.appeal.user_name}</p>
                <p className="text-xs text-slate-600 mt-1">{reviewDialog.appeal.reason}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Current penalty stars: {reviewDialog.appeal.user_stars}/5
                </p>
              </div>
              {reviewDialog.action === "approve" && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700">
                  Approving this appeal will remove 1 negative star from the user's account.
                </div>
              )}
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">
                  Admin Note (optional)
                </label>
                <textarea
                  data-testid="appeal-admin-note"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-800 resize-none h-20 focus:border-blue-400 outline-none"
                  placeholder="Optional note to the user..."
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setReviewDialog(null)}
                  className="flex-1 border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-appeal-review-btn"
                  onClick={handleReview}
                  disabled={submitting}
                  className="flex-1 font-display text-white"
                  style={{ background: reviewDialog.action === "approve" ? "#10B981" : "#EF4444" }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                  {reviewDialog.action === "approve" ? "Approve & Remove Star" : "Reject Appeal"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function AppealCard({ appeal, onApprove, onReject, resolved }) {
  const statusConfig = {
    pending: { color: "bg-amber-50 text-amber-600", icon: Clock, label: "Pending" },
    approved: { color: "bg-green-50 text-green-600", icon: CheckCircle, label: "Approved" },
    rejected: { color: "bg-red-50 text-red-500", icon: XCircle, label: "Rejected" },
  };
  const cfg = statusConfig[appeal.status] || statusConfig.pending;
  const Icon = cfg.icon;

  return (
    <div
      data-testid={`appeal-card-${appeal.id}`}
      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 font-display">{appeal.user_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
              <Icon size={10} /> {cfg.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
              {appeal.user_stars}/5 stars
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{appeal.reason}</p>
          {appeal.admin_note && (
            <p className="text-xs text-slate-400 mt-1 italic">Note: {appeal.admin_note}</p>
          )}
          <p className="text-xs text-slate-400 mt-1.5">
            Filed {new Date(appeal.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {appeal.reviewed_at && (
              <span className="ml-2">
                · Reviewed {new Date(appeal.reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </p>
        </div>
        {!resolved && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              data-testid={`approve-appeal-${appeal.id}`}
              onClick={onApprove}
              className="text-xs font-display text-white"
              style={{ background: "#10B981" }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              data-testid={`reject-appeal-${appeal.id}`}
              onClick={onReject}
              variant="outline"
              className="text-xs border-red-200 text-red-500 hover:bg-red-50"
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
