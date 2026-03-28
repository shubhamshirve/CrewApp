import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Users, UserPlus, Check, X, ArrowRightLeft, Upload, PackageCheck, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_ROLES = ["Second Shooter","Traditional Videographer","Cinematic Videographer","Drone Operator","Photo Assistant","Video Assistant","Lighting Technician"];
const STATUS_BADGE = {
  pending: { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", label: "Pending" },
  accepted: { bg: "rgba(16,185,129,0.15)", color: "#10B981", label: "Accepted" },
  rejected: { bg: "rgba(239,68,68,0.15)", color: "#EF4444", label: "Rejected" },
  counter_offered: { bg: "rgba(139,92,246,0.15)", color: "#8B5CF6", label: "Counter Offer" },
  expired: { bg: "rgba(107,114,128,0.15)", color: "#6B7280", label: "Expired" },
};

const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 rounded-xl";

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

  const [inviteForm, setInviteForm] = useState({ freelancer_id: "", session_id: "", session_date: "", role: DEFAULT_ROLES[0], proposed_fee: "" });
  const [workspaceForm, setWorkspaceForm] = useState({ type: "moodboard", title: "", content: "" });
  const [counterFee, setCounterFee] = useState({});

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get("/platform/roles").then(r => {
      if (r.data?.roles?.length) setRolesList(r.data.roles);
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
    } catch { toast.error("Failed to load gig"); } finally { setLoading(false); }
  };

  const isLead = gig?.lead_photographer_id === user?.id;
  const myInvite = gig?.invites?.find(i => i.freelancer_id === user?.id);

  const handleInvite = async () => {
    if (!inviteForm.freelancer_id || !inviteForm.session_id || !inviteForm.proposed_fee) { toast.error("Fill all invite fields"); return; }
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

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (!gig) return <Layout><p className="text-muted-foreground text-center mt-20">Gig not found.</p></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="p-5 rounded-2xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground font-display">{gig.title}</h1>
              {gig.description && <p className="text-sm text-muted-foreground mt-1">{gig.description}</p>}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-display flex-shrink-0" style={{ background: gig.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.15)", color: gig.status === "active" ? "#10B981" : "#9CA3AF" }}>
              {gig.status}
            </span>
          </div>
          {gig.data_delivered && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs p-2 rounded-lg mt-2" style={{ background: "rgba(16,185,129,0.1)" }}>
              <PackageCheck size={14} /> Data marked as delivered
            </div>
          )}
        </div>

        <Tabs defaultValue="sessions">
          <TabsList className="bg-slate-100 border border-border">
            <TabsTrigger value="sessions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-display text-xs">Sessions</TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-display text-xs">Team ({gig.invites?.length || 0})</TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-display text-xs">Workspace</TabsTrigger>
          </TabsList>

          {/* Sessions */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            {gig.sessions?.map((s, i) => (
              <div key={s.id || i} className="p-4 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded font-display" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>{s.event_type}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1.5"><Calendar size={13} className="text-muted-foreground" />{s.date}</span>
                  <span className="flex items-center gap-1.5"><Clock size={13} className="text-muted-foreground" />{s.start_time} – {s.end_time}</span>
                  <span className="flex items-center gap-1.5"><MapPin size={13} className="text-muted-foreground" />{s.location}{s.venue_name && ` · ${s.venue_name}`}</span>
                </div>
              </div>
            ))}

            {/* Freelancer: my invite */}
            {!isLead && myInvite && (
              <div className="p-4 rounded-xl border mt-4" style={{ background: myInvite.status === "pending" ? "rgba(245,158,11,0.05)" : "white", borderColor: myInvite.status === "pending" ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.08)" }}>
                <p className="text-sm font-semibold text-foreground font-display mb-1">Your Invite</p>
                <p className="text-xs text-muted-foreground mb-2">{myInvite.role} · Proposed fee: ₹{myInvite.proposed_fee?.toLocaleString("en-IN")}</p>
                {myInvite.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" data-testid="accept-invite-btn" onClick={() => handleRespond(myInvite.id, "accept")} style={{ background: "#10B981", color: "#fff" }} className="font-display text-xs gap-1"><Check size={13} /> Accept</Button>
                    <div className="flex items-center gap-1">
                      <Input data-testid="counter-fee-input" className={`w-28 h-8 text-xs ${inputClass}`} type="number" placeholder="Counter ₹" value={counterFee[myInvite.id] || ""} onChange={e => setCounterFee(p => ({ ...p, [myInvite.id]: e.target.value }))} />
                      <Button size="sm" data-testid="counter-offer-btn" onClick={() => handleRespond(myInvite.id, "counter", parseFloat(counterFee[myInvite.id]))} variant="outline" className="h-8 border-purple-500/40 text-purple-600 text-xs gap-1 hover:bg-purple-500/10"><ArrowRightLeft size={12} /> Counter</Button>
                    </div>
                    <Button size="sm" data-testid="reject-invite-btn" onClick={() => handleRespond(myInvite.id, "reject")} variant="outline" className="border-red-500/30 text-red-500 text-xs hover:bg-red-500/10 gap-1"><X size={12} /> Reject</Button>
                  </div>
                )}
                {myInvite.status === "accepted" && !gig.data_delivered && (
                  <Button size="sm" data-testid="handover-btn" onClick={handleHandover} variant="outline" className="border-emerald-500/30 text-emerald-600 text-xs hover:bg-emerald-500/10 gap-1 mt-2"><PackageCheck size={13} /> Mark Data Delivered</Button>
                )}
                {myInvite.status === "accepted" && (
                  <Button size="sm" data-testid="download-contract-btn" onClick={() => handleDownloadContract(myInvite.id)} variant="outline" className="border-blue-500/30 text-blue-600 text-xs hover:bg-blue-500/10 gap-1 mt-2 ml-2"><FileText size={13} /> Download Contract</Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Team */}
          <TabsContent value="team" className="mt-4">
            {isLead && (
              <div className="flex gap-2 mb-4">
                <Button data-testid="invite-crew-btn" onClick={() => setShowInvite(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-display font-semibold gap-1">
                  <UserPlus size={14} /> Invite Crew
                </Button>
                <Button data-testid="ai-suggest-btn" onClick={() => { setShowAI(true); handleAISuggest(); }} size="sm" variant="outline" className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 gap-1">
                  <Sparkles size={14} /> AI Suggest
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {gig.invites?.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No team invites yet</p>
                </div>
              ) : gig.invites?.map(inv => {
                const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.pending;
                return (
                  <div key={inv.id} data-testid={`invite-card-${inv.id}`} className="p-4 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground font-display">{inv.freelancer?.full_name || "Unknown"}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-display" style={badge}>{badge.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.role} · ₹{(inv.agreed_fee || inv.counter_fee || inv.proposed_fee)?.toLocaleString("en-IN")}</p>
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
                        <Button size="sm" data-testid={`download-contract-${inv.id}`} onClick={() => handleDownloadContract(inv.id)} variant="outline" className="border-blue-500/30 text-blue-600 text-xs hover:bg-blue-500/10 gap-1">
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
              <Button data-testid="add-workspace-btn" onClick={() => setShowWorkspace(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-display gap-1">
                <Upload size={14} /> Add File
              </Button>
            </div>
            {gig.workspace_files?.length === 0 ? (
              <div className="text-center py-12">
                <Upload size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No workspace files yet. Add mood boards, call sheets, or location pins.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gig.workspace_files?.map(f => (
                  <div key={f.id} className="p-4 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-primary font-display uppercase">{f.type}</span>
                    </div>
                    <p className="text-sm text-foreground font-display font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{f.content}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-white border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display">Invite Crew Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-slate-600 text-sm font-display">Select Freelancer *</Label>
              <select data-testid="invite-freelancer-select" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`} value={inviteForm.freelancer_id} onChange={e => setInviteForm(p => ({ ...p, freelancer_id: e.target.value }))}>
                <option value="">Choose from connections...</option>
                {connections.map(c => <option key={c.user?.id} value={c.user?.id}>{c.user?.full_name} – {c.user?.primary_role}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-slate-600 text-sm font-display">Session *</Label>
              <select data-testid="invite-session-select" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`} value={inviteForm.session_id} onChange={e => { const sess = gig.sessions.find(s => s.id === e.target.value); setInviteForm(p => ({ ...p, session_id: e.target.value, session_date: sess?.date || "" })); }}>
                <option value="">Select session...</option>
                {gig.sessions?.map(s => <option key={s.id} value={s.id}>{s.event_type} – {s.date}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-slate-600 text-sm font-display">Role *</Label>
              <select data-testid="invite-role-select" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`} value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}>
                {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-slate-600 text-sm font-display">Proposed Fee (₹) *</Label>
              <Input data-testid="invite-fee-input" className={`mt-1 ${inputClass}`} type="number" placeholder="e.g. 8000" value={inviteForm.proposed_fee} onChange={e => setInviteForm(p => ({ ...p, proposed_fee: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowInvite(false)} className="flex-1 border-border text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-full">Cancel</Button>
              <Button data-testid="send-invite-btn" onClick={handleInvite} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-display">Send Invite</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace Dialog */}
      <Dialog open={showWorkspace} onOpenChange={setShowWorkspace}>
        <DialogContent className="bg-white border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display">Add to Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-slate-600 text-sm font-display">Type</Label>
              <select className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`} value={workspaceForm.type} onChange={e => setWorkspaceForm(p => ({ ...p, type: e.target.value }))}>
                <option value="moodboard">Mood Board</option>
                <option value="callsheet">Call Sheet</option>
                <option value="location_pin">Location Pin</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-600 text-sm font-display">Title *</Label>
              <Input className={`mt-1 ${inputClass}`} placeholder="e.g. Venue entrance shots" value={workspaceForm.title} onChange={e => setWorkspaceForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-600 text-sm font-display">Content *</Label>
              <textarea className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border resize-none h-20`} placeholder="URL, text description, or WhatsApp location link" value={workspaceForm.content} onChange={e => setWorkspaceForm(p => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowWorkspace(false)} className="flex-1 border-border text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-full">Cancel</Button>
              <Button data-testid="submit-workspace-btn" onClick={handleAddWorkspace} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-display">Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="max-w-lg bg-white border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display flex items-center gap-2"><Sparkles size={16} className="text-purple-500" /> AI Crew Suggestions</DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-muted-foreground">Generating suggestions...</span>
            </div>
          ) : (
            <div className="mt-2 p-4 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-border">
              {aiSuggestion || "No suggestions yet."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
