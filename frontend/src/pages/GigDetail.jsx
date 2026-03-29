import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, MapPin, Users, UserPlus, Check, X,
  ArrowRightLeft, Upload, PackageCheck, Sparkles, FileText, IndianRupee, CheckCircle2,
  Pencil, Trash2, Plus, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_ROLES = [
  "Second Shooter", "Traditional Videographer", "Cinematic Videographer",
  "Drone Operator", "Photo Assistant", "Video Assistant", "Lighting Technician",
];

const STATUS_BADGE = {
  pending:        { background: "rgba(245,158,11,0.1)",  color: "#D97706", label: "Pending" },
  accepted:       { background: "rgba(16,185,129,0.1)",  color: "#059669", label: "Accepted" },
  rejected:       { background: "rgba(239,68,68,0.1)",   color: "#DC2626", label: "Rejected" },
  counter_offered:{ background: "rgba(139,92,246,0.1)",  color: "#7C3AED", label: "Counter Offer" },
  expired:        { background: "rgba(107,114,128,0.1)", color: "#4B5563", label: "Expired" },
};

const inputClass = "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400";

export default function GigDetail() {
  const { id } = useParams();
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [rolesList, setRolesList] = useState(DEFAULT_ROLES);

  const [inviteForm, setInviteForm] = useState({
    freelancer_id: "", session_id: "", session_date: "", role: DEFAULT_ROLES[0], proposed_fee: "",
  });
  const [workspaceForm, setWorkspaceForm] = useState({ type: "moodboard", title: "", content: "" });
  const [counterFee, setCounterFee] = useState({});
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(null);  // { invite_id, type, mode: "record"|"edit", suggested_amount }
  const [paymentForm, setPaymentForm] = useState({ amount: "", notes: "" });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Gig edit/delete
  const [showEditGig, setShowEditGig] = useState(false);
  const [editGigForm, setEditGigForm] = useState({ title: "", description: "" });
  const [editGigSaving, setEditGigSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGig, setDeletingGig] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({ date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" });
  const [addingSession, setAddingSession] = useState(false);
  const [eventTypes, setEventTypes] = useState(["Wedding", "Pre-Wedding Shoot", "Reception", "Corporate", "Birthday", "Other"]);

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get("/platform/roles").then(r => {
      if (r.data?.roles?.length) setRolesList(r.data.roles);
    }).catch(() => {});
    api.get("/platform/event-types").then(r => {
      if (r.data?.event_types?.length) setEventTypes(r.data.event_types);
    }).catch(() => {});
  }, []);

  const load = async () => {
    try {
      const [gigRes, connRes] = await Promise.all([
        api.get(`/gigs/${id}`),
        api.get("/connections"),
      ]);
      setGig(gigRes.data);
      setConnections(connRes.data);

      // Auto mark-viewed: if current user has a pending invite, record seen timestamp
      const myInv = gigRes.data?.invites?.find(i => i.freelancer_id === user?.id && i.status === "pending");
      if (myInv && !myInv.invite_viewed_at) {
        api.put(`/gigs/invites/${myInv.id}/mark-viewed`).catch(() => {});
      }
    } catch { toast.error("Failed to load gig"); } finally { setLoading(false); }
  };

  const loadLedger = async () => {
    if (!id) return;
    setLedgerLoading(true);
    try {
      const res = await api.get(`/gigs/${id}/ledger`);
      setLedger(res.data);
    } catch { /* gig may not have accepted invites yet */ } finally { setLedgerLoading(false); }
  };

  const isLead = gig?.lead_photographer_id === user?.id;

  const handleRecordPayment = async () => {
    if (!paymentDialog) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setPaymentSubmitting(true);
    try {
      if (paymentDialog.mode === "edit") {
        await api.put(`/gigs/invites/${paymentDialog.invite_id}/payment`, {
          type: paymentDialog.type,
          amount: parseFloat(paymentForm.amount),
          notes: paymentForm.notes || undefined,
        });
        toast.success(`${paymentDialog.type === "advance" ? "Advance" : "Balance"} payment updated`);
      } else {
        await api.post(`/gigs/invites/${paymentDialog.invite_id}/payment`, {
          type: paymentDialog.type,
          amount: parseFloat(paymentForm.amount),
          notes: paymentForm.notes || undefined,
        });
        toast.success(`${paymentDialog.type === "advance" ? "Advance" : "Balance"} payment recorded`);
      }
      setPaymentDialog(null);
      setPaymentForm({ amount: "", notes: "" });
      loadLedger();
    } catch { toast.error("Failed to save payment"); } finally { setPaymentSubmitting(false); }
  };

  const handleDeletePayment = async (invite_id, type) => {
    if (!window.confirm(`Remove ${type} payment? This will mark it as unpaid.`)) return;
    try {
      await api.delete(`/gigs/invites/${invite_id}/payment/${type}`);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} payment removed`);
      loadLedger();
    } catch { toast.error("Failed to remove payment"); }
  };
  const handleEditGigSave = async () => {
    if (!editGigForm.title.trim()) { toast.error("Title is required"); return; }
    setEditGigSaving(true);
    try {
      const res = await api.put(`/gigs/${id}`, editGigForm);
      setGig(g => ({ ...g, title: res.data.title, description: res.data.description }));
      setShowEditGig(false);
      toast.success("Gig updated!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to update"); } finally { setEditGigSaving(false); }
  };

  const handleDeleteGig = async () => {
    setDeletingGig(true);
    try {
      await api.delete(`/gigs/${id}`);
      toast.success("Gig deleted");
      navigate("/gigs");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); } finally { setDeletingGig(false); }
  };

  const handleAddSession = async () => {
    if (!newSession.date || !newSession.location) { toast.error("Date and location are required"); return; }
    setAddingSession(true);
    try {
      await api.post(`/gigs/${id}/sessions`, newSession);
      toast.success("Session added!");
      setShowAddSession(false);
      setNewSession({ date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add session"); } finally { setAddingSession(false); }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await api.delete(`/gigs/${id}/sessions/${sessionId}`);
      toast.success("Session removed");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Cannot remove session"); }
  };

  const myInvite = gig?.invites?.find(i => i.freelancer_id === user?.id);

  const handleInvite = async () => {
    if (!inviteForm.freelancer_id || !inviteForm.session_id || !inviteForm.proposed_fee) {
      toast.error("Fill all invite fields");
      return;
    }
    try {
      await api.post(`/gigs/${id}/invites`, { ...inviteForm, proposed_fee: parseFloat(inviteForm.proposed_fee) });
      toast.success("Invite sent!");
      setShowInvite(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleRespond = async (inviteId, action, fee = null) => {
    try {
      await api.put(`/gigs/invites/${inviteId}/respond`, { action, counter_fee: fee });
      toast.success(`Invite ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "counter sent"}!`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleLeadAcceptCounter = async (inviteId) => {
    try {
      await api.put(`/gigs/invites/${inviteId}/lead-accept-counter`);
      toast.success("Counter-offer accepted!");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleAddWorkspace = async () => {
    if (!workspaceForm.title || !workspaceForm.content) { toast.error("Fill title and content"); return; }
    try {
      await api.post(`/gigs/${id}/workspace`, workspaceForm);
      toast.success("Added to workspace!");
      setShowWorkspace(false);
      setWorkspaceForm({ type: "moodboard", title: "", content: "" });
      load();
    } catch { toast.error("Failed"); }
  };

  const handleHandover = async () => {
    try {
      await api.put(`/gigs/${id}/handover`);
      toast.success("Data marked as delivered!");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleAISuggest = async () => {
    if (!gig) return;
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const res = await api.post("/ai/crew-suggestions", {
        gig_title: gig.title,
        event_types: gig.sessions.map(s => s.event_type),
        dates: gig.sessions.map(s => s.date),
        location: gig.sessions[0]?.location || "",
        roles_needed: rolesList.slice(0, 3),
      });
      setAiSuggestion(res.data.suggestion);
    } catch { toast.error("AI service unavailable"); } finally { setAiLoading(false); }
  };

  const handleDownloadContract = async (inviteId) => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("token");
      const response = await fetch(`${BACKEND_URL}/api/gigs/invites/${inviteId}/contract`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json();
        toast.error(err.detail || "Failed to download contract");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crewbook_contract_${inviteId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Contract downloaded!");
    } catch {
      toast.error("Failed to download contract");
    }
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!gig) return (
    <Layout><p className="text-slate-400 text-center mt-20">Gig not found.</p></Layout>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 font-display">{gig.title}</h1>
              {gig.description && <p className="text-sm text-slate-500 mt-1">{gig.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-display"
                style={{
                  background: gig.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
                  color: gig.status === "active" ? "#059669" : "#6B7280",
                }}
              >
                {gig.status}
              </span>
              {isLead && (
                <>
                  <Button
                    size="sm"
                    data-testid="edit-gig-btn"
                    variant="outline"
                    className="h-7 text-xs font-display border-slate-200 text-slate-600 gap-1"
                    onClick={() => { setEditGigForm({ title: gig.title, description: gig.description || "" }); setShowEditGig(true); }}
                  >
                    <Pencil size={11} /> Edit
                  </Button>
                  <Button
                    size="sm"
                    data-testid="delete-gig-btn"
                    variant="outline"
                    className="h-7 text-xs font-display border-red-200 text-red-500 hover:bg-red-50 gap-1"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={11} /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
          {gig.data_delivered && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs p-2 rounded-lg mt-2 bg-emerald-50">
              <PackageCheck size={14} /> Data marked as delivered
            </div>
          )}
        </div>

        <Tabs defaultValue="sessions" onValueChange={v => { if (v === "ledger") loadLedger(); }}>
          <TabsList className="bg-slate-100 border border-slate-200">
            <TabsTrigger value="sessions" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600">
              Sessions
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600">
              Team ({gig.invites?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600">
              Workspace
            </TabsTrigger>
            {isLead && (
              <TabsTrigger value="ledger" data-testid="ledger-tab" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600">
                <IndianRupee size={12} className="mr-1" />Ledger
              </TabsTrigger>
            )}
          </TabsList>

          {/* Sessions */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            {isLead && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  data-testid="add-session-btn"
                  onClick={() => setShowAddSession(true)}
                  className="h-7 text-xs font-display gap-1 text-white"
                  style={{ background: "#F97316" }}
                >
                  <Plus size={12} /> Add Session
                </Button>
              </div>
            )}
            {gig.sessions?.map((s, i) => (
              <div key={s.id || i} className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded font-display bg-orange-50 text-orange-600">{s.event_type}</span>
                  {isLead && gig.sessions.length > 1 && (
                    <button
                      data-testid={`delete-session-${s.id}`}
                      onClick={() => handleDeleteSession(s.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                      title="Remove session"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-700 flex-wrap">
                  <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" />{s.date}</span>
                  <span className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />{s.start_time} – {s.end_time}</span>
                  <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" />{s.location}{s.venue_name && ` · ${s.venue_name}`}</span>
                </div>
              </div>
            ))}

            {/* Freelancer: my invite */}
            {!isLead && myInvite && (
              <div
                className="p-4 rounded-xl border mt-4"
                style={{
                  background: myInvite.status === "pending" ? "rgba(249,115,22,0.04)" : "#FFFFFF",
                  borderColor: myInvite.status === "pending" ? "rgba(249,115,22,0.2)" : "#E2E8F0",
                }}
              >
                <p className="text-sm font-semibold text-slate-900 font-display mb-1">Your Invite</p>
                <p className="text-xs text-slate-500 mb-2">
                  {myInvite.role} · Proposed fee: ₹{myInvite.proposed_fee?.toLocaleString("en-IN")}
                </p>
                {myInvite.status === "pending" && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" data-testid="accept-invite-btn" onClick={() => handleRespond(myInvite.id, "accept")} style={{ background: "#10B981", color: "#fff" }} className="font-display text-xs gap-1">
                      <Check size={13} /> Accept
                    </Button>
                    <div className="flex items-center gap-1">
                      <Input
                        data-testid="counter-fee-input"
                        className={`w-28 h-8 text-xs ${inputClass}`}
                        type="number"
                        placeholder="Counter ₹"
                        value={counterFee[myInvite.id] || ""}
                        onChange={e => setCounterFee(p => ({ ...p, [myInvite.id]: e.target.value }))}
                      />
                      <Button size="sm" data-testid="counter-offer-btn" onClick={() => handleRespond(myInvite.id, "counter", parseFloat(counterFee[myInvite.id]))} variant="outline" className="h-8 border-purple-200 text-purple-600 text-xs gap-1 hover:bg-purple-50">
                        <ArrowRightLeft size={12} /> Counter
                      </Button>
                    </div>
                    <Button size="sm" data-testid="reject-invite-btn" onClick={() => handleRespond(myInvite.id, "reject")} variant="outline" className="border-red-200 text-red-500 text-xs hover:bg-red-50 gap-1">
                      <X size={12} /> Reject
                    </Button>
                  </div>
                )}
                {myInvite.status === "accepted" && !gig.data_delivered && (
                  <Button size="sm" data-testid="handover-btn" onClick={handleHandover} variant="outline" className="border-emerald-200 text-emerald-600 text-xs hover:bg-emerald-50 gap-1 mt-2">
                    <PackageCheck size={13} /> Mark Data Delivered
                  </Button>
                )}
                {myInvite.status === "accepted" && (
                  <Button size="sm" data-testid="download-contract-btn" onClick={() => handleDownloadContract(myInvite.id)} variant="outline" className="border-blue-200 text-blue-600 text-xs hover:bg-blue-50 gap-1 mt-2 ml-2">
                    <FileText size={13} /> Download Contract
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Team */}
          <TabsContent value="team" className="mt-4">
            {isLead && (
              <div className="flex gap-2 mb-4">
                <Button data-testid="invite-crew-btn" onClick={() => setShowInvite(true)} size="sm" style={{ background: "#F97316", color: "#fff" }} className="font-display font-semibold gap-1">
                  <UserPlus size={14} /> Invite Crew
                </Button>
                <Button data-testid="ai-suggest-btn" onClick={() => { setShowAI(true); handleAISuggest(); }} size="sm" variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50 gap-1">
                  <Sparkles size={14} /> AI Suggest
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {gig.invites?.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No team invites yet</p>
                </div>
              ) : gig.invites?.map(inv => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.pending;
                const seenAt = inv.invite_viewed_at
                  ? new Date(inv.invite_viewed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : null;
                return (
                  <div key={inv.id} data-testid={`invite-card-${inv.id}`} className="p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 font-display">{inv.freelancer?.full_name || "Unknown"}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-display" style={badge}>{badge.label}</span>
                          {/* Read receipt badge */}
                          {seenAt ? (
                            <span data-testid={`seen-badge-${inv.id}`} className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <Eye size={10} /> Seen {seenAt}
                            </span>
                          ) : inv.status === "pending" ? (
                            <span data-testid={`unseen-badge-${inv.id}`} className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                              <EyeOff size={10} /> Not seen yet
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {inv.role} · ₹{(inv.agreed_fee || inv.counter_fee || inv.proposed_fee)?.toLocaleString("en-IN")}
                        </p>
                        {inv.status === "counter_offered" && (
                          <p className="text-xs text-purple-600 mt-0.5">Counter: ₹{inv.counter_fee?.toLocaleString("en-IN")}</p>
                        )}
                      </div>
                      {isLead && inv.status === "counter_offered" && (
                        <Button size="sm" data-testid={`accept-counter-${inv.id}`} onClick={() => handleLeadAcceptCounter(inv.id)} style={{ background: "#10B981", color: "#fff" }} className="text-xs font-display">
                          Accept Counter
                        </Button>
                      )}
                      {inv.status === "accepted" && (
                        <Button size="sm" data-testid={`download-contract-${inv.id}`} onClick={() => handleDownloadContract(inv.id)} variant="outline" className="border-blue-200 text-blue-600 text-xs hover:bg-blue-50 gap-1">
                          <FileText size={12} /> Contract
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Workspace */}
          <TabsContent value="workspace" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button data-testid="add-workspace-btn" onClick={() => setShowWorkspace(true)} size="sm" style={{ background: "#F97316", color: "#fff" }} className="font-display gap-1">
                <Upload size={14} /> Add File
              </Button>
            </div>
            {gig.workspace_files?.length === 0 ? (
              <div className="text-center py-12">
                <Upload size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No workspace files yet. Add mood boards, call sheets, or location pins.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gig.workspace_files?.map(f => (
                  <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-orange-600 font-display uppercase">{f.type}</span>
                    </div>
                    <p className="text-sm text-slate-900 font-display font-medium">{f.title}</p>
                    <p className="text-xs text-slate-500 mt-1 break-all">{f.content}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Financial Ledger */}
          {isLead && (
            <TabsContent value="ledger" className="mt-4">
              {ledgerLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !ledger || ledger.entries?.length === 0 ? (
                <div className="text-center py-16">
                  <IndianRupee size={36} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No accepted team members yet</p>
                  <p className="text-xs text-slate-300 mt-1">Invite crew and once they accept, payment tracking will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Fees", value: `₹${ledger.summary.total_fee.toLocaleString("en-IN")}`, color: "text-slate-900" },
                      { label: "Advance Due", value: `₹${ledger.summary.total_advance.toLocaleString("en-IN")}`, color: "text-amber-600" },
                      { label: "Balance Due", value: `₹${ledger.summary.total_balance.toLocaleString("en-IN")}`, color: "text-blue-600" },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                        <p className={`text-base font-bold font-display ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Entries */}
                  <div className="space-y-3">
                    {ledger.entries.map(entry => (
                      <div key={entry.invite_id} data-testid={`ledger-entry-${entry.invite_id}`} className="p-4 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 font-display">{entry.freelancer_name}</p>
                            <p className="text-xs text-slate-500">{entry.role} · {entry.session_date}</p>
                            <p className="text-sm font-bold text-slate-900 mt-1">₹{entry.agreed_fee?.toLocaleString("en-IN")}</p>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-xs text-slate-500">Advance ₹{entry.advance_amount?.toLocaleString("en-IN")}</span>
                              {entry.advance_paid ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 size={14} className="text-green-500" />
                                  <button
                                    title="Edit advance"
                                    onClick={() => { setPaymentDialog({ invite_id: entry.invite_id, type: "advance", mode: "edit" }); setPaymentForm({ amount: String(entry.advance_amount), notes: entry.payment_notes || "" }); }}
                                    className="text-slate-300 hover:text-orange-400 transition-colors"
                                    data-testid={`edit-advance-${entry.invite_id}`}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    title="Undo advance"
                                    onClick={() => handleDeletePayment(entry.invite_id, "advance")}
                                    className="text-slate-300 hover:text-red-400 transition-colors"
                                    data-testid={`undo-advance-${entry.invite_id}`}
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  data-testid={`pay-advance-${entry.invite_id}`}
                                  onClick={() => { setPaymentDialog({ invite_id: entry.invite_id, type: "advance", mode: "record", suggested_amount: entry.advance_amount }); setPaymentForm({ amount: String(entry.advance_amount), notes: "" }); }}
                                  className="h-6 text-xs px-2 font-display text-white"
                                  style={{ background: "#F59E0B" }}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-xs text-slate-500">Balance ₹{entry.balance_amount?.toLocaleString("en-IN")}</span>
                              {entry.balance_paid ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 size={14} className="text-green-500" />
                                  <button
                                    title="Edit balance"
                                    onClick={() => { setPaymentDialog({ invite_id: entry.invite_id, type: "balance", mode: "edit" }); setPaymentForm({ amount: String(entry.balance_amount), notes: entry.payment_notes || "" }); }}
                                    className="text-slate-300 hover:text-orange-400 transition-colors"
                                    data-testid={`edit-balance-${entry.invite_id}`}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    title="Undo balance"
                                    onClick={() => handleDeletePayment(entry.invite_id, "balance")}
                                    className="text-slate-300 hover:text-red-400 transition-colors"
                                    data-testid={`undo-balance-${entry.invite_id}`}
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  data-testid={`pay-balance-${entry.invite_id}`}
                                  onClick={() => { setPaymentDialog({ invite_id: entry.invite_id, type: "balance", mode: "record", suggested_amount: entry.balance_amount }); setPaymentForm({ amount: String(entry.balance_amount), notes: "" }); }}
                                  className="h-6 text-xs px-2 font-display text-white"
                                  style={{ background: "#3B82F6" }}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        {entry.payment_notes && (
                          <p className="text-xs text-slate-400 mt-2 italic">{entry.payment_notes}</p>
                        )}
                        {(entry.advance_paid_at || entry.balance_paid_at) && (
                          <div className="flex gap-4 mt-2 text-xs text-slate-400">
                            {entry.advance_paid_at && <span>Advance paid {new Date(entry.advance_paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                            {entry.balance_paid_at && <span>Balance paid {new Date(entry.balance_paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Invite Crew Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-slate-700 text-sm font-display">Select Freelancer *</Label>
              <select
                data-testid="invite-freelancer-select"
                className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}
                value={inviteForm.freelancer_id}
                onChange={e => setInviteForm(p => ({ ...p, freelancer_id: e.target.value }))}
              >
                <option value="">Choose from connections...</option>
                {connections.map(c => (
                  <option key={c.user?.id} value={c.user?.id}>{c.user?.full_name} – {c.user?.primary_role}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Session *</Label>
              <select
                data-testid="invite-session-select"
                className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}
                value={inviteForm.session_id}
                onChange={e => {
                  const sess = gig.sessions.find(s => s.id === e.target.value);
                  setInviteForm(p => ({ ...p, session_id: e.target.value, session_date: sess?.date || "" }));
                }}
              >
                <option value="">Select session...</option>
                {gig.sessions?.map(s => (
                  <option key={s.id} value={s.id}>{s.event_type} – {s.date}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Role *</Label>
              <select
                data-testid="invite-role-select"
                className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}
                value={inviteForm.role}
                onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
              >
                {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Proposed Fee (₹) *</Label>
              <Input
                data-testid="invite-fee-input"
                className={`mt-1 ${inputClass}`}
                type="number"
                placeholder="e.g. 8000"
                value={inviteForm.proposed_fee}
                onChange={e => setInviteForm(p => ({ ...p, proposed_fee: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowInvite(false)} className="flex-1 border-slate-200 text-slate-500">
                Cancel
              </Button>
              <Button data-testid="send-invite-btn" onClick={handleInvite} className="flex-1 font-display" style={{ background: "#F97316", color: "#fff" }}>
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace Dialog */}
      <Dialog open={showWorkspace} onOpenChange={setShowWorkspace}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Add to Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-slate-700 text-sm font-display">Type</Label>
              <select
                className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}
                value={workspaceForm.type}
                onChange={e => setWorkspaceForm(p => ({ ...p, type: e.target.value }))}
              >
                <option value="moodboard">Mood Board</option>
                <option value="callsheet">Call Sheet</option>
                <option value="location_pin">Location Pin</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Title *</Label>
              <Input
                className={`mt-1 ${inputClass}`}
                placeholder="e.g. Venue entrance shots"
                value={workspaceForm.title}
                onChange={e => setWorkspaceForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Content *</Label>
              <textarea
                className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border resize-none h-20`}
                placeholder="URL, text description, or WhatsApp location link"
                value={workspaceForm.content}
                onChange={e => setWorkspaceForm(p => ({ ...p, content: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowWorkspace(false)} className="flex-1 border-slate-200 text-slate-500">
                Cancel
              </Button>
              <Button data-testid="submit-workspace-btn" onClick={handleAddWorkspace} className="flex-1 font-display" style={{ background: "#F97316", color: "#fff" }}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Gig Dialog */}
      <Dialog open={showEditGig} onOpenChange={setShowEditGig}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Edit Gig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-display text-slate-600 mb-1 block">Gig Title *</label>
              <input
                data-testid="edit-gig-title-input"
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                value={editGigForm.title}
                onChange={e => setEditGigForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-display text-slate-600 mb-1 block">Description</label>
              <textarea
                data-testid="edit-gig-desc-input"
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-800 resize-none h-20 focus:border-orange-400 outline-none"
                placeholder="Brief overview of the event…"
                value={editGigForm.description}
                onChange={e => setEditGigForm(p => ({ ...p, description: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Note: Session dates and times cannot be changed after creation.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowEditGig(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="save-edit-gig-btn"
                onClick={handleEditGigSave}
                disabled={editGigSaving}
                className="flex-1 font-display text-white"
                style={{ background: "#F97316" }}
              >
                {editGigSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Delete Gig?</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              This will permanently delete <strong>"{gig?.title}"</strong> and all pending invites. This cannot be undone.
              Gigs with accepted crew members cannot be deleted.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="confirm-delete-gig-btn"
                onClick={handleDeleteGig}
                disabled={deletingGig}
                className="flex-1 font-display text-white bg-red-500 hover:bg-red-600"
              >
                {deletingGig ? "Deleting…" : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Session Dialog */}
      <Dialog open={showAddSession} onOpenChange={setShowAddSession}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Add New Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">Date *</label>
                <input
                  data-testid="new-session-date"
                  type="date"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                  value={newSession.date}
                  onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">Event Type</label>
                <select
                  data-testid="new-session-event-type"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                  value={newSession.event_type}
                  onChange={e => setNewSession(p => ({ ...p, event_type: e.target.value }))}
                >
                  {eventTypes.map(et => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">Start Time</label>
                <input type="time" className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                  value={newSession.start_time} onChange={e => setNewSession(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">End Time</label>
                <input type="time" className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                  value={newSession.end_time} onChange={e => setNewSession(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-display text-slate-600 mb-1 block">Location / City *</label>
              <input
                data-testid="new-session-location"
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                placeholder="Mumbai"
                value={newSession.location}
                onChange={e => setNewSession(p => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-display text-slate-600 mb-1 block">Venue Name</label>
              <input
                data-testid="new-session-venue"
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                placeholder="Hotel / Banquet Hall"
                value={newSession.venue_name}
                onChange={e => setNewSession(p => ({ ...p, venue_name: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowAddSession(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="confirm-add-session-btn"
                onClick={handleAddSession}
                disabled={addingSession}
                className="flex-1 font-display text-white"
                style={{ background: "#F97316" }}
              >
                {addingSession ? "Adding…" : "Add Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="max-w-lg bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" /> AI Crew Suggestions
            </DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-slate-500">Generating suggestions...</span>
            </div>
          ) : (
            <div className="mt-2 p-4 rounded-lg text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-200">
              {aiSuggestion || "No suggestions yet."}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={() => setPaymentDialog(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">
              {paymentDialog?.mode === "edit" ? "Edit" : "Record"} {paymentDialog?.type === "advance" ? "Advance" : "Balance"} Payment
            </DialogTitle>
          </DialogHeader>
          {paymentDialog && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">Amount (₹) *</label>
                <input
                  data-testid="payment-amount-input"
                  type="number"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none"
                  placeholder={`Suggested: ₹${paymentDialog.suggested_amount?.toLocaleString("en-IN")}`}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-display text-slate-600 mb-1 block">Notes (optional)</label>
                <textarea
                  data-testid="payment-notes-input"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-800 resize-none h-16 focus:border-orange-400 outline-none"
                  placeholder="e.g. Paid via UPI"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPaymentDialog(null)} className="flex-1 border-slate-200 text-slate-500">
                  Cancel
                </Button>
                <Button
                  data-testid="confirm-payment-btn"
                  onClick={handleRecordPayment}
                  disabled={paymentSubmitting}
                  className="flex-1 font-display text-white"
                  style={{ background: paymentDialog.type === "advance" ? "#F59E0B" : "#3B82F6" }}
                >
                  {paymentSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : "Confirm Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
