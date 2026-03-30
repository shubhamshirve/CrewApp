import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, MapPin, Users, UserPlus, Check, X,
  ArrowRightLeft, Upload, PackageCheck, Sparkles, FileText, IndianRupee, CheckCircle2,
  Pencil, Trash2, Plus, Eye, EyeOff, Bell, BellOff, MessageSquare, Send,
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
  const { eventTypes: platformEventTypes, roles: platformRoles } = usePlatform();
  const navigate = useNavigate();
  const location = useLocation();

  // Read ?tab= query param — used by push notification deep-links (e.g. ?tab=chat)
  const initialTab = new URLSearchParams(location.search).get("tab") || "sessions";
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [connections, setConnections] = useState([]);

  // Use platform context instead of per-page API calls
  const rolesList = platformRoles?.length ? platformRoles : DEFAULT_ROLES;
  const eventTypes = platformEventTypes;

  const [inviteForm, setInviteForm] = useState({
    freelancer_id: "", session_id: "", session_date: "", role: DEFAULT_ROLES[0], proposed_fee: "",
  });
  const [workspaceForm, setWorkspaceForm] = useState({ type: "moodboard", title: "", content: "" });
  const [counterFee, setCounterFee] = useState({});
  const [snoozing, setSnoozing] = useState(false);
  const [conflictDialog, setConflictDialog] = useState(null); // { message, pendingForm }

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const chatBottomRef = useRef(null);
  const chatPollRef = useRef(null);
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

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const [gigRes, connRes] = await Promise.all([
        api.get(`/gigs/${id}`),
        api.get("/connections"),
      ]);
      setGig(gigRes.data);
      setConnections(connRes.data);

      // Auto mark-viewed: mark ALL pending invites for this user as seen
      const pendingInvites = gigRes.data?.invites?.filter(i => i.freelancer_id === user?.id && i.status === "pending" && !i.invite_viewed_at) ?? [];
      for (const inv of pendingInvites) {
        api.put(`/gigs/invites/${inv.id}/mark-viewed`).catch(() => {});
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

  const myInvites = gig?.invites?.filter(i => i.freelancer_id === user?.id) ?? [];

  const handleInvite = async (force = false) => {
    if (!inviteForm.freelancer_id || !inviteForm.session_id || !inviteForm.proposed_fee) {
      toast.error("Fill all invite fields");
      return;
    }
    try {
      const url = `/gigs/${id}/invites${force ? "?force=true" : ""}`;
      await api.post(url, { ...inviteForm, proposed_fee: parseFloat(inviteForm.proposed_fee) });
      toast.success("Invite sent!");
      setShowInvite(false);
      setConflictDialog(null);
      load();
    } catch (err) {
      if (err.response?.status === 409) {
        // Conflict — show override dialog instead of generic toast
        const msg = err.response?.data?.detail?.replace("Schedule conflict: ", "") || "Schedule conflict detected.";
        setConflictDialog({ message: msg, pendingForm: { ...inviteForm } });
        setShowInvite(false);
      } else {
        toast.error(err.response?.data?.detail || "Failed");
      }
    }
  };

  const handleRespond = async (inviteId, action, fee = null) => {
    try {
      await api.put(`/gigs/invites/${inviteId}/respond`, { action, counter_fee: fee });
      toast.success(`Invite ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "counter sent"}!`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleSnooze = async (inviteId, hours = 4) => {
    setSnoozing(true);
    try {
      await api.put(`/gigs/invites/${inviteId}/snooze`, { hours });
      toast.success(`Invite snoozed for ${hours}h — we'll remind you then!`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to snooze"); } finally { setSnoozing(false); }
  };

  // ── Chat helpers ─────────────────────────────────────────────────────────────
  const fetchChat = useCallback(async (markRead = false) => {
    if (!id) return;
    try {
      const res = await api.get(`/gigs/${id}/messages`);
      setChatMessages(res.data.messages || []);
      setChatUnread(res.data.unread_count || 0);
      if (markRead && res.data.unread_count > 0) {
        await api.put(`/gigs/${id}/messages/read`);
        setChatUnread(0);
      }
    } catch { /* ignore */ }
  }, [id]);

  const startChatPoll = useCallback(() => {
    fetchChat(true);
    chatPollRef.current = setInterval(() => fetchChat(false), 4000);
  }, [fetchChat]);

  const stopChatPoll = useCallback(() => {
    if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      startChatPoll();
    } else {
      stopChatPoll();
    }
    return () => stopChatPoll();
  }, [activeTab, startChatPoll, stopChatPoll]);

  // Auto-scroll to bottom when new messages arrive on chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  // Poll unread count even when chat tab isn't active (for badge)
  useEffect(() => {
    const unreadPoll = setInterval(async () => {
      if (activeTab !== "chat" && id) {
        try {
          const res = await api.get(`/gigs/${id}/messages`);
          setChatUnread(res.data.unread_count || 0);
        } catch { /* ignore */ }
      }
    }, 15000);
    return () => clearInterval(unreadPoll);
  }, [id, activeTab]);

  const handleSendMessage = async () => {
    const content = chatInput.trim();
    if (!content) return;
    setChatSending(true);
    try {
      const res = await api.post(`/gigs/${id}/messages`, { content });
      setChatMessages(prev => [...prev, res.data]);
      setChatInput("");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to send"); } finally { setChatSending(false); }
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
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 font-display leading-tight">{gig.title}</h1>
              {gig.description && <p className="text-sm text-slate-500 mt-1">{gig.description}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
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
                    <Pencil size={11} /> <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    data-testid="delete-gig-btn"
                    variant="outline"
                    className="h-7 text-xs font-display border-red-200 text-red-500 hover:bg-red-50 gap-1"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={11} /> <span className="hidden sm:inline">Delete</span>
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

        <Tabs defaultValue={initialTab} onValueChange={v => { setActiveTab(v); if (v === "ledger") loadLedger(); }}>
          <TabsList className="bg-slate-100 border border-slate-200 overflow-x-auto flex w-full">
            <TabsTrigger value="sessions" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600 flex-shrink-0">
              Sessions
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600 flex-shrink-0">
              Team ({gig.invites?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="chat" data-testid="chat-tab" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600 relative flex-shrink-0">
              <MessageSquare size={12} className="mr-1" />Chat
              {chatUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600 flex-shrink-0">
              Workspace
            </TabsTrigger>
            {isLead && (
              <TabsTrigger value="ledger" data-testid="ledger-tab" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-display text-xs text-slate-600 flex-shrink-0">
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

            {/* Freelancer: all my invites for this gig */}
            {!isLead && myInvites.length > 0 && (
              <div className="space-y-3 mt-4">
                {myInvites.map(inv => {
                  const sess = gig.sessions?.find(s => s.id === inv.session_id);
                  const sessionLabel = sess
                    ? `${sess.date} · ${sess.start_time}–${sess.end_time} · ${sess.location}`
                    : inv.session_date || "Session";
                  return (
                    <div
                      key={inv.id}
                      data-testid={`my-invite-card-${inv.id}`}
                      className="p-4 rounded-xl border"
                      style={{
                        background: inv.status === "pending" ? "rgba(249,115,22,0.04)" : "#FFFFFF",
                        borderColor: inv.status === "pending" ? "rgba(249,115,22,0.2)" : "#E2E8F0",
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-slate-900 font-display">Your Invite</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-display ${
                          inv.status === "accepted" ? "bg-emerald-50 text-emerald-600"
                          : inv.status === "rejected" ? "bg-red-50 text-red-500"
                          : inv.status === "counter_offered" ? "bg-purple-50 text-purple-600"
                          : "bg-orange-50 text-orange-500"
                        }`}>{inv.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{inv.role} · ₹{inv.proposed_fee?.toLocaleString("en-IN")}</p>
                      <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
                        <Calendar size={10} /> {sessionLabel}
                      </p>
                      {inv.status === "pending" && (
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" data-testid={`accept-invite-btn-${inv.id}`} onClick={() => handleRespond(inv.id, "accept")} style={{ background: "#10B981", color: "#fff" }} className="font-display text-xs gap-1">
                            <Check size={13} /> Accept
                          </Button>
                          <div className="flex items-center gap-1">
                            <Input
                              data-testid={`counter-fee-input-${inv.id}`}
                              className={`w-28 h-8 text-xs ${inputClass}`}
                              type="number"
                              placeholder="Counter ₹"
                              value={counterFee[inv.id] || ""}
                              onChange={e => setCounterFee(p => ({ ...p, [inv.id]: e.target.value }))}
                            />
                            <Button size="sm" data-testid={`counter-offer-btn-${inv.id}`} onClick={() => handleRespond(inv.id, "counter", parseFloat(counterFee[inv.id]))} variant="outline" className="h-8 border-purple-200 text-purple-600 text-xs gap-1 hover:bg-purple-50">
                              <ArrowRightLeft size={12} /> Counter
                            </Button>
                          </div>
                          <Button size="sm" data-testid={`reject-invite-btn-${inv.id}`} onClick={() => handleRespond(inv.id, "reject")} variant="outline" className="border-red-200 text-red-500 text-xs hover:bg-red-50 gap-1">
                            <X size={12} /> Reject
                          </Button>
                          <Button
                            size="sm"
                            data-testid={`snooze-invite-btn-${inv.id}`}
                            onClick={() => handleSnooze(inv.id, 4)}
                            disabled={snoozing}
                            variant="outline"
                            className="border-amber-200 text-amber-600 text-xs hover:bg-amber-50 gap-1"
                          >
                            <BellOff size={12} /> {snoozing ? "Snoozing…" : "Snooze 4h"}
                          </Button>
                        </div>
                      )}
                      {/* Snoozed indicator */}
                      {inv.snoozed_until && inv.status === "pending" && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 w-fit" data-testid={`snoozed-indicator-${inv.id}`}>
                          <Bell size={11} />
                          Reminder set for {new Date(inv.snoozed_until).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {inv.status === "counter_offered" && (
                        <p className="text-xs text-purple-600 mt-1">Counter offer: ₹{inv.counter_fee?.toLocaleString("en-IN")}</p>
                      )}
                      {inv.status === "accepted" && !gig.data_delivered && (
                        <Button size="sm" data-testid={`handover-btn-${inv.id}`} onClick={handleHandover} variant="outline" className="border-emerald-200 text-emerald-600 text-xs hover:bg-emerald-50 gap-1 mt-2">
                          <PackageCheck size={13} /> Mark Data Delivered
                        </Button>
                      )}
                    </div>
                  );
                })}
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
                        <span className="text-xs text-emerald-600 font-medium">Accepted</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Chat */}
          <TabsContent value="chat" className="mt-4">
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden" style={{ height: "480px" }}>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare size={32} className="text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-display">No messages yet</p>
                    <p className="text-xs text-slate-300 mt-1">Send a message to start the gig conversation</p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, i) => {
                      const isMine = msg.sender_id === user?.id;
                      const showName = !isMine && (i === 0 || chatMessages[i - 1]?.sender_id !== msg.sender_id);
                      const time = new Date(msg.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={msg.id} data-testid={`chat-msg-${msg.id}`} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                            {showName && (
                              <p className="text-[10px] text-slate-400 mb-1 px-1 font-display">{msg.sender_name}</p>
                            )}
                            <div
                              className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                isMine
                                  ? "bg-orange-500 text-white rounded-br-sm"
                                  : "bg-slate-100 text-slate-900 rounded-bl-sm"
                              }`}
                            >
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-0.5 px-1">{time}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </>
                )}
              </div>
              {/* Input area */}
              <div className="border-t border-slate-100 p-3 flex gap-2 items-end bg-white">
                <textarea
                  data-testid="chat-input"
                  className="flex-1 resize-none bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl px-3 py-2 outline-none focus:border-orange-400 transition-colors"
                  rows={1}
                  placeholder="Type a message…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                  }}
                  style={{ minHeight: "38px", maxHeight: "96px" }}
                />
                <Button
                  data-testid="chat-send-btn"
                  onClick={handleSendMessage}
                  disabled={chatSending || !chatInput.trim()}
                  className="h-9 w-9 p-0 rounded-xl flex-shrink-0 text-white"
                  style={{ background: chatInput.trim() ? "#F97316" : undefined }}
                >
                  {chatSending
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={14} />
                  }
                </Button>
              </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      {/* Schedule Conflict Override Dialog */}
      <Dialog open={!!conflictDialog} onOpenChange={() => setConflictDialog(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-amber-600" />
              </span>
              Schedule Conflict Detected
            </DialogTitle>
          </DialogHeader>
          {conflictDialog && (
            <div className="mt-2 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                {conflictDialog.message}
              </div>
              <p className="text-xs text-slate-500">
                The 90-minute buffer rule helps avoid back-to-back exhaustion. You can still send the invite — the freelancer will decide.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setConflictDialog(null); setShowInvite(true); }}
                  className="flex-1 border-slate-200 text-slate-500 text-xs"
                  data-testid="conflict-cancel-btn"
                >
                  Go Back
                </Button>
                <Button
                  data-testid="conflict-force-send-btn"
                  onClick={() => handleInvite(true)}
                  className="flex-1 font-display text-white text-xs gap-1"
                  style={{ background: "#F97316" }}
                >
                  Send Anyway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
