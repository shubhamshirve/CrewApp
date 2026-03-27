import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, Calendar, Users, Briefcase, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES = ["Haldi","Mehendi","Sangeet","Baraat","Wedding","Reception","Pre-Wedding Shoot","Corporate","Birthday","Other"];
const STATUS_COLORS = {
  draft: { bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
  active: { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
  completed: { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
  cancelled: { bg: "rgba(239,68,68,0.15)", color: "#EF4444" },
};

const inputClass = "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500/50";

export default function Gigs() {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [newGig, setNewGig] = useState({ title: "", description: "" });
  const [sessions, setSessions] = useState([{ date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" }]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get("/gigs");
      setGigs(res.data);
    } catch { } finally { setLoading(false); }
  };

  const addSession = () => setSessions(p => [...p, { date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" }]);
  const updateSession = (i, k, v) => setSessions(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const removeSession = (i) => setSessions(p => p.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!newGig.title) { toast.error("Enter gig title"); return; }
    const validSessions = sessions.filter(s => s.date && s.location);
    if (!validSessions.length) { toast.error("Add at least one complete session"); return; }
    setCreating(true);
    try {
      const res = await api.post("/gigs", { title: newGig.title, description: newGig.description, sessions: validSessions });
      toast.success("Gig created!");
      setShowCreate(false);
      setGigs(p => [res.data, ...p]);
      navigate(`/gigs/${res.data.id}`);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create gig"); } finally { setCreating(false); }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white font-display">Gigs</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Manage your bookings and invites</p>
          </div>
          {user?.is_verified && (
            <Button data-testid="create-gig-btn" onClick={() => setShowCreate(true)} style={{ background: "#F59E0B", color: "#000" }} className="font-display font-semibold gap-2">
              <Plus size={16} /> New Gig
            </Button>
          )}
        </div>

        {/* Gigs List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase size={36} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm mb-2">No gigs yet</p>
            {user?.is_verified ? (
              <Button data-testid="empty-create-gig-btn" onClick={() => setShowCreate(true)} size="sm" style={{ background: "#F59E0B", color: "#000" }} className="font-display">Create First Gig</Button>
            ) : (
              <p className="text-xs text-zinc-600">Get verified to start booking crew.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {gigs.map(g => {
              const s = STATUS_COLORS[g.status] || STATUS_COLORS.draft;
              const isLead = g.lead_photographer_id === user?.id;
              return (
                <div key={g.id} data-testid={`gig-item-${g.id}`} className="p-5 rounded-xl border card-hover cursor-pointer" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }} onClick={() => navigate(`/gigs/${g.id}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-semibold text-white font-display truncate">{g.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-display" style={s}>{g.status}</span>
                        {!isLead && <span className="text-xs text-zinc-500 font-display">invited</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Calendar size={11} />{g.sessions?.length || 0} session{g.sessions?.length !== 1 ? "s" : ""}</span>
                        {g.sessions?.[0] && <span>{g.sessions[0].event_type} · {g.sessions[0].date}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 flex-shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Gig Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display">Create New Gig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-zinc-300 text-sm font-display">Gig Title *</Label>
              <Input data-testid="gig-title-input" className={`mt-1 ${inputClass}`} placeholder="e.g. Sharma Wedding - Dec 2025" value={newGig.title} onChange={e => setNewGig(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-zinc-300 text-sm font-display">Description</Label>
              <textarea data-testid="gig-desc-input" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border resize-none h-16`} placeholder="Brief overview of the event..." value={newGig.description} onChange={e => setNewGig(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Sessions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-zinc-300 text-sm font-display">Sessions</Label>
                <button data-testid="add-session-btn" onClick={addSession} className="text-xs text-amber-400 hover:text-amber-300 font-display flex items-center gap-1">
                  <Plus size={12} /> Add Session
                </button>
              </div>
              <div className="space-y-3">
                {sessions.map((s, i) => (
                  <div key={i} className="p-4 rounded-lg border" style={{ background: "#1C1C1F", borderColor: "rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-zinc-400 font-display uppercase tracking-wide">Session {i + 1}</span>
                      {sessions.length > 1 && (
                        <button data-testid={`remove-session-${i}`} onClick={() => removeSession(i)} className="text-zinc-600 hover:text-red-400"><Trash2 size={13} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-zinc-400 text-xs font-display">Date *</Label>
                        <Input type="date" className={`mt-1 ${inputClass} text-xs`} value={s.date} onChange={e => updateSession(i, "date", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs font-display">Event Type</Label>
                        <select className={`mt-1 w-full px-3 py-2 rounded-lg text-xs ${inputClass} border`} value={s.event_type} onChange={e => updateSession(i, "event_type", e.target.value)}>
                          {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs font-display">Start Time</Label>
                        <Input type="time" className={`mt-1 ${inputClass} text-xs`} value={s.start_time} onChange={e => updateSession(i, "start_time", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs font-display">End Time</Label>
                        <Input type="time" className={`mt-1 ${inputClass} text-xs`} value={s.end_time} onChange={e => updateSession(i, "end_time", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-zinc-400 text-xs font-display">Location *</Label>
                        <Input className={`mt-1 ${inputClass} text-xs`} placeholder="City / Area" value={s.location} onChange={e => updateSession(i, "location", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-zinc-400 text-xs font-display">Venue Name</Label>
                        <Input className={`mt-1 ${inputClass} text-xs`} placeholder="Hotel / Banquet Hall name" value={s.venue_name} onChange={e => updateSession(i, "venue_name", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1 border-white/10 text-zinc-400">Cancel</Button>
              <Button data-testid="submit-create-gig-btn" onClick={handleCreate} className="flex-1 font-display font-semibold" style={{ background: "#F59E0B", color: "#000" }} disabled={creating}>
                {creating ? "Creating..." : "Create Gig"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
