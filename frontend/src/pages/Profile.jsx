import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, MapPin, Star, Camera, CheckCircle, User, UserPlus, UserCheck, Zap, StickyNote, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CAT_COLORS = { Camera: "#3B82F6", Lens: "#8B5CF6", Lighting: "#F59E0B", Drone: "#10B981", Audio: "#EC4899", Other: "#6B7280" };

export default function Profile() {
  const { id } = useParams();
  const { user, api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState({ avg_rating: null, total_ratings: 0, ratings: [] });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteExists, setNoteExists] = useState(false);

  const isOwn = user?.id === id;

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, ratingsRes] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/ratings/user/${id}`),
        ]);
        setProfile(userRes.data);
        setRatings(ratingsRes.data);
        if (!isOwn) {
          const conns = await api.get("/connections");
          const found = conns.data.find(c => c.user?.id === id);
          setConnectionStatus(found ? "connected" : null);
          // Load private note
          setNoteLoading(true);
          const noteRes = await api.get(`/notes/${id}`);
          setNote(noteRes.data.content || "");
          setNoteExists(noteRes.data.exists || false);
          setNoteLoading(false);
        }
      } catch { toast.error("Failed to load profile"); } finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleConnect = async () => {
    try {
      await api.post(`/connections/${id}`);
      setConnectionStatus("pending");
      toast.success("Connection request sent!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      await api.put(`/notes/${id}`, { content: note });
      setNoteExists(true);
      toast.success("Note saved privately!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save note");
    } finally { setNoteSaving(false); }
  };

  const handleDeleteNote = async () => {
    try {
      await api.delete(`/notes/${id}`);
      setNote("");
      setNoteExists(false);
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (!profile) return <Layout><p className="text-muted-foreground text-center mt-20">Profile not found.</p></Layout>;

  const avgStyle = ratings.ratings.length ? {
    punctuality: (ratings.ratings.reduce((s, r) => s + r.punctuality, 0) / ratings.ratings.length).toFixed(1),
    gear_handling: (ratings.ratings.reduce((s, r) => s + r.gear_handling, 0) / ratings.ratings.length).toFixed(1),
    teamwork: (ratings.ratings.reduce((s, r) => s + r.teamwork, 0) / ratings.ratings.length).toFixed(1),
  } : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header Card */}
        <div className="p-6 rounded-2xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="profile-header">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-100 border border-border">
              {profile.profile_image ? <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" /> : <User size={32} className="text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground font-display">{profile.full_name}</h2>
                {profile.is_verified && (
                  <span data-testid="verified-badge" className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>
                    <Shield size={10} /> Verified
                  </span>
                )}
                {profile.is_standby && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>Standby</span>
                )}
                {profile.is_ghost_mode && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(107,114,128,0.15)", color: "#9CA3AF" }}>Ghost Mode</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-muted-foreground">
                {profile.primary_role && <span className="font-display text-primary">{profile.primary_role}</span>}
                {profile.secondary_role && <span className="text-muted-foreground">• {profile.secondary_role}</span>}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                {profile.location && <span className="flex items-center gap-1"><MapPin size={11} />{profile.location}</span>}
                {ratings.avg_rating && <span className="flex items-center gap-1"><Star size={11} className="text-primary" />{ratings.avg_rating.toFixed(1)} ({ratings.total_ratings})</span>}
                {profile.primary_rate > 0 && <span>₹{profile.primary_rate?.toLocaleString("en-IN")}/day</span>}
              </div>
              {profile.bio && <p className="text-sm text-slate-600 mt-3 leading-relaxed">{profile.bio}</p>}
            </div>
          </div>
          {!isOwn && (
            <div className="mt-4 flex gap-2">
              {connectionStatus === "connected" ? (
                <Button size="sm" variant="outline" className="border-border text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-full" disabled data-testid="connected-badge">
                  <UserCheck size={14} className="mr-1.5 text-emerald-500" /> Connected
                </Button>
              ) : connectionStatus === "pending" ? (
                <Button size="sm" variant="outline" className="border-border text-muted-foreground rounded-full" disabled data-testid="pending-connection-badge">
                  Request Sent
                </Button>
              ) : (
                <Button size="sm" data-testid="connect-btn" onClick={handleConnect} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-display font-semibold">
                  <UserPlus size={14} className="mr-1.5" /> Connect
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Style & Editing */}
          {(profile.style_tags?.length > 0 || profile.editing_ecosystem?.length > 0) && (
            <div className="p-5 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-foreground font-display mb-3">Style & Workflow</h3>
              {profile.style_tags?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5 font-display uppercase tracking-wide">Shooting Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.style_tags.map(t => <span key={t} className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-display">{t}</span>)}
                  </div>
                </div>
              )}
              {profile.editing_ecosystem?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-display uppercase tracking-wide">Editing Software</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.editing_ecosystem.map(e => <span key={e} className="text-xs px-2.5 py-1 rounded-full border border-border font-display bg-slate-100 text-slate-600">{e}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ratings */}
          <div className="p-5 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="ratings-section">
            <h3 className="text-sm font-semibold text-foreground font-display mb-3">Rating Breakdown</h3>
            {avgStyle ? (
              <div className="space-y-2.5">
                {[["Punctuality", avgStyle.punctuality], ["Gear Handling", avgStyle.gear_handling], ["Teamwork", avgStyle.teamwork]].map(([label, val]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground font-display">{label}</span>
                      <span className="text-primary font-display">{val}/5</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(val / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">{ratings.total_ratings} anonymous review{ratings.total_ratings !== 1 ? "s" : ""}</p>
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-4">No ratings yet</p>}
          </div>

          {/* Gear Vault */}
          {profile.gear_vault?.length > 0 && (
            <div className="p-5 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground font-display mb-3 flex items-center gap-2">
                <Camera size={14} className="text-primary" /> Gear Vault
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.gear_vault.map((g, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-display" style={{ borderColor: `${CAT_COLORS[g.category] || "#6B7280"}30`, background: `${CAT_COLORS[g.category] || "#6B7280"}0F`, color: CAT_COLORS[g.category] || "#9CA3AF" }}>
                    {g.name}
                    <span className="text-[10px] opacity-60">{g.category}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Private Lead Notes — only shown when viewing someone else's profile */}
        {!isOwn && (
          <div data-testid="lead-notes-section" className="p-5 rounded-xl bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground font-display">Private Notes</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-display ml-auto bg-primary/10 text-primary">
                Only visible to you
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Keep private notes about this crew member — availability, strengths, past experience. Nobody else can see these.
            </p>
            {noteLoading ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <>
                <textarea
                  data-testid="lead-note-input"
                  className="w-full bg-slate-50 border border-border text-foreground placeholder:text-muted-foreground text-sm rounded-lg px-3 py-2.5 outline-none focus:border-primary/50 resize-none h-24 transition-colors"
                  placeholder={`Private notes about ${profile.full_name}…`}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    data-testid="save-note-btn"
                    onClick={handleSaveNote}
                    disabled={noteSaving || !note.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full gap-1.5 text-xs font-display"
                  >
                    <Save size={12} />
                    {noteSaving ? "Saving…" : "Save Note"}
                  </Button>
                  {noteExists && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="delete-note-btn"
                      onClick={handleDeleteNote}
                      className="gap-1.5 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-full font-display"
                    >
                      <Trash2 size={12} /> Delete
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
