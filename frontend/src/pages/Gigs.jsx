import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronRight, Calendar, Briefcase, Trash2, Pencil, Shield } from "lucide-react";
import { toast } from "sonner";
import { sanitizeText, validateFutureDate, validateTimeRange, minLength, maxLength } from "@/utils/validation";
import VerificationModal from "@/components/VerificationModal";

const FieldError = ({ msg }) =>
  msg ? <p className="text-xs text-red-500 mt-0.5">{msg}</p> : null;
const STATUS_COLORS = {
  draft: { bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
  active: { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
  completed: { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
  cancelled: { bg: "rgba(239,68,68,0.15)", color: "#EF4444" },
};

const inputClass = "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400/60";

export default function Gigs() {
  const { user, api, refreshUser } = useAuth();
  const { eventTypes } = usePlatform();
  const navigate = useNavigate();
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGig, setNewGig] = useState({ title: "", description: "" });
  const [sessions, setSessions] = useState([{ date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" }]);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // gig object to confirm delete
  const [deleting, setDeleting] = useState(false);
  const [gigErrors, setGigErrors] = useState({});
  const [sessionErrors, setSessionErrors] = useState([]);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await api.get("/gigs");
      setGigs(res.data);
    } catch { } finally { setLoading(false); }
  };

  const addSession = () => {
    setSessions(p => [...p, { date: "", start_time: "09:00", end_time: "18:00", location: "", venue_name: "", event_type: "Wedding" }]);
    setSessionErrors(p => [...p, {}]);
  };
  const updateSession = (i, k, v) => {
    setSessions(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
    setSessionErrors(p => p.map((e, idx) => idx === i ? { ...e, [k]: "" } : e));
  };
  const removeSession = (i) => {
    setSessions(p => p.filter((_, idx) => idx !== i));
    setSessionErrors(p => p.filter((_, idx) => idx !== i));
  };

  const handleCreate = async () => {
    // Validate title
    const titleErr = minLength(newGig.title, 3, "Title") || maxLength(newGig.title, 200, "Title");
    if (!newGig.title.trim()) {
      setGigErrors({ title: "Gig title is required" });
      return;
    }
    if (titleErr) { setGigErrors({ title: titleErr }); return; }
    setGigErrors({});

    // Validate sessions
    const sErrs = sessions.map(s => ({
      date: validateFutureDate(s.date, "Date"),
      location: !s.location.trim() ? "Location is required" : "",
      time: validateTimeRange(s.start_time, s.end_time),
    }));
    setSessionErrors(sErrs);
    const hasSessionErr = sErrs.some(e => e.date || e.location || e.time);
    if (hasSessionErr) { toast.error("Fix session errors before creating"); return; }

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/gigs/${deleteTarget.id}`);
      setGigs(p => p.filter(g => g.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Gig deleted");
    } catch (err) { toast.error(err.response?.data?.detail || "Cannot delete gig"); } finally { setDeleting(false); }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 font-display">Gigs</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your bookings and invites</p>
          </div>
          {user?.is_verified && (
            <Button data-testid="create-gig-btn" onClick={() => setShowCreate(true)} style={{ background: "#E05D26" }} className="font-display font-semibold gap-2 text-white">
              <Plus size={16} /> New Gig
            </Button>
          )}
        </div>

        {/* Gigs List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-2">No gigs yet</p>
            {user?.is_verified ? (
              <Button data-testid="empty-create-gig-btn" onClick={() => setShowCreate(true)} size="sm" style={{ background: "#E05D26" }} className="font-display text-white">Create First Gig</Button>
            ) : (
              <Button data-testid="verify-to-create-btn" size="sm" onClick={() => setShowVerification(true)} className="font-display text-white gap-1" style={{ background: "#3B82F6" }}>
                <Shield size={13} /> Get Verified to Create Gigs
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {gigs.map(g => {
              const s = STATUS_COLORS[g.status] || STATUS_COLORS.draft;
              const isLead = g.lead_photographer_id === user?.id;
              return (
                <div key={g.id} data-testid={`gig-item-${g.id}`} className="p-5 rounded-xl border border-slate-200 card-hover bg-white shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/gigs/${g.id}`)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-900 font-display truncate">{g.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-display" style={s}>{g.status}</span>
                        {!isLead && <span className="text-xs text-slate-400 font-display">invited</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Calendar size={11} />{g.sessions?.length || 0} session{g.sessions?.length !== 1 ? "s" : ""}</span>
                        {g.sessions?.[0] && <span>{g.sessions[0].event_type} · {g.sessions[0].date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isLead && (
                        <>
                          <button
                            data-testid={`edit-gig-list-${g.id}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/gigs/${g.id}`); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
                            title="Edit gig"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            data-testid={`delete-gig-list-${g.id}`}
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Delete gig"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <ChevronRight size={16} className="text-slate-300 cursor-pointer" onClick={() => navigate(`/gigs/${g.id}`)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Gig Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Create New Gig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-slate-700 text-sm font-display">Gig Title *</Label>
              <Input data-testid="gig-title-input" className={`mt-1 ${inputClass} ${gigErrors.title ? "border-red-400" : ""}`} placeholder="e.g. Sharma Wedding - Dec 2025" value={newGig.title}
                onChange={e => { setNewGig(p => ({ ...p, title: e.target.value })); setGigErrors({}); }}
                onBlur={e => {
                  const v = e.target.value;
                  if (!v.trim()) setGigErrors({ title: "Gig title is required" });
                  else if (v.trim().length < 3) setGigErrors({ title: "Title must be at least 3 characters" });
                }}
              />
              <FieldError msg={gigErrors.title} />
            </div>
            <div>
              <Label className="text-slate-700 text-sm font-display">Description</Label>
              <textarea data-testid="gig-desc-input" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border resize-none h-16`} placeholder="Brief overview of the event..." value={newGig.description}
                onChange={e => setNewGig(p => ({ ...p, description: sanitizeText(e.target.value) }))}
                maxLength={2000}
              />
              {newGig.description.length > 1800 && (
                <p className="text-xs text-amber-500 mt-0.5">{2000 - newGig.description.length} characters remaining</p>
              )}
            </div>

            {/* Sessions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-slate-700 text-sm font-display">Sessions</Label>
                <button data-testid="add-session-btn" onClick={addSession} className="text-xs text-orange-500 hover:text-orange-600 font-display flex items-center gap-1">
                  <Plus size={12} /> Add Session
                </button>
              </div>
              <div className="space-y-3">
                {sessions.map((s, i) => (
                  <div key={i} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 font-display uppercase tracking-wide">Session {i + 1}</span>
                      {sessions.length > 1 && (
                        <button data-testid={`remove-session-${i}`} onClick={() => removeSession(i)} className="text-slate-400 hover:text-red-400"><Trash2 size={13} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-slate-500 text-xs font-display">Date *</Label>
                        <Input type="date" className={`mt-1 ${inputClass} text-xs ${sessionErrors[i]?.date ? "border-red-400" : ""}`} value={s.date}
                          onChange={e => updateSession(i, "date", e.target.value)}
                          onBlur={e => {
                            const err = validateFutureDate(e.target.value, "Date");
                            setSessionErrors(p => p.map((se, idx) => idx === i ? { ...se, date: err } : se));
                          }}
                        />
                        <FieldError msg={sessionErrors[i]?.date} />
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs font-display">Event Type</Label>
                        <select className={`mt-1 w-full px-3 py-2 rounded-lg text-xs ${inputClass} border`} value={s.event_type} onChange={e => updateSession(i, "event_type", e.target.value)}>
                          {eventTypes.map(et => <option key={et} value={et}>{et}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs font-display">Start Time</Label>
                        <Input type="time" className={`mt-1 ${inputClass} text-xs`} value={s.start_time}
                          onChange={e => updateSession(i, "start_time", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-slate-500 text-xs font-display">End Time</Label>
                        <Input type="time" className={`mt-1 ${inputClass} text-xs ${sessionErrors[i]?.time ? "border-red-400" : ""}`} value={s.end_time}
                          onChange={e => updateSession(i, "end_time", e.target.value)}
                          onBlur={() => {
                            const err = validateTimeRange(s.start_time, s.end_time);
                            setSessionErrors(p => p.map((se, idx) => idx === i ? { ...se, time: err } : se));
                          }}
                        />
                        <FieldError msg={sessionErrors[i]?.time} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-slate-500 text-xs font-display">Location *</Label>
                        <Input className={`mt-1 ${inputClass} text-xs ${sessionErrors[i]?.location ? "border-red-400" : ""}`} placeholder="City / Area" value={s.location}
                          onChange={e => updateSession(i, "location", e.target.value)}
                          onBlur={e => {
                            const err = !e.target.value.trim() ? "Location is required" : "";
                            setSessionErrors(p => p.map((se, idx) => idx === i ? { ...se, location: err } : se));
                          }}
                        />
                        <FieldError msg={sessionErrors[i]?.location} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-slate-500 text-xs font-display">Venue Name</Label>
                        <Input className={`mt-1 ${inputClass} text-xs`} placeholder="Hotel / Banquet Hall name" value={s.venue_name} onChange={e => updateSession(i, "venue_name", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button data-testid="submit-create-gig-btn" onClick={handleCreate} className="flex-1 font-display font-semibold text-white" style={{ background: "#E05D26" }} disabled={creating}>
                {creating ? "Creating..." : "Create Gig"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Delete Gig?</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              Permanently delete <strong>"{deleteTarget?.title}"</strong>? Gigs with accepted crew members cannot be deleted.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="confirm-delete-gig-btn"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 font-display text-white bg-red-500 hover:bg-red-600"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VerificationModal
        open={showVerification}
        onClose={() => setShowVerification(false)}
        onSuccess={() => { setShowVerification(false); refreshUser(); }}
        api={api}
        verificationStatus={user?.verification_status || "not_submitted"}
      />
    </Layout>
  );
}
