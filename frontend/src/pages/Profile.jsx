import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, MapPin, Star, Camera, CheckCircle, User, UserPlus, UserCheck, Zap } from "lucide-react";
import { toast } from "sonner";

const CAT_COLORS = { Camera: "#3B82F6", Lens: "#8B5CF6", Lighting: "#F59E0B", Drone: "#10B981", Audio: "#EC4899", Other: "#6B7280" };

export default function Profile() {
  const { id } = useParams();
  const { user, api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState({ avg_rating: null, total_ratings: 0, ratings: [] });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (!profile) return <Layout><p className="text-zinc-400 text-center mt-20">Profile not found.</p></Layout>;

  const avgStyle = ratings.ratings.length ? {
    punctuality: (ratings.ratings.reduce((s, r) => s + r.punctuality, 0) / ratings.ratings.length).toFixed(1),
    gear_handling: (ratings.ratings.reduce((s, r) => s + r.gear_handling, 0) / ratings.ratings.length).toFixed(1),
    teamwork: (ratings.ratings.reduce((s, r) => s + r.teamwork, 0) / ratings.ratings.length).toFixed(1),
  } : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header Card */}
        <div className="p-6 rounded-2xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }} data-testid="profile-header">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#1C1C1F", border: "2px solid rgba(255,255,255,0.08)" }}>
              {profile.profile_image ? <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" /> : <User size={32} className="text-zinc-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-white font-display">{profile.full_name}</h2>
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
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-zinc-400">
                {profile.primary_role && <span className="font-display text-amber-400">{profile.primary_role}</span>}
                {profile.secondary_role && <span className="text-zinc-500">• {profile.secondary_role}</span>}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
                {profile.location && <span className="flex items-center gap-1"><MapPin size={11} />{profile.location}</span>}
                {ratings.avg_rating && <span className="flex items-center gap-1"><Star size={11} className="text-amber-400" />{ratings.avg_rating.toFixed(1)} ({ratings.total_ratings})</span>}
                {profile.primary_rate > 0 && <span>₹{profile.primary_rate?.toLocaleString("en-IN")}/day</span>}
              </div>
              {profile.bio && <p className="text-sm text-zinc-300 mt-3 leading-relaxed">{profile.bio}</p>}
            </div>
          </div>
          {!isOwn && (
            <div className="mt-4 flex gap-2">
              {connectionStatus === "connected" ? (
                <Button size="sm" variant="outline" className="border-white/10 text-zinc-300" disabled data-testid="connected-badge">
                  <UserCheck size={14} className="mr-1.5 text-emerald-400" /> Connected
                </Button>
              ) : connectionStatus === "pending" ? (
                <Button size="sm" variant="outline" className="border-white/10 text-zinc-400" disabled data-testid="pending-connection-badge">
                  Request Sent
                </Button>
              ) : (
                <Button size="sm" data-testid="connect-btn" onClick={handleConnect} style={{ background: "#F59E0B", color: "#000" }} className="font-display font-semibold">
                  <UserPlus size={14} className="mr-1.5" /> Connect
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Style & Editing */}
          {(profile.style_tags?.length > 0 || profile.editing_ecosystem?.length > 0) && (
            <div className="p-5 rounded-xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
              <h3 className="text-sm font-semibold text-white font-display mb-3">Style & Workflow</h3>
              {profile.style_tags?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-1.5 font-display uppercase tracking-wide">Shooting Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.style_tags.map(t => <span key={t} className="text-xs px-2.5 py-1 rounded-full border font-display" style={{ borderColor: "rgba(245,158,11,0.3)", color: "#F59E0B", background: "rgba(245,158,11,0.08)" }}>{t}</span>)}
                  </div>
                </div>
              )}
              {profile.editing_ecosystem?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5 font-display uppercase tracking-wide">Editing Software</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.editing_ecosystem.map(e => <span key={e} className="text-xs px-2.5 py-1 rounded-full border font-display" style={{ borderColor: "rgba(255,255,255,0.1)", color: "#a1a1aa" }}>{e}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ratings */}
          <div className="p-5 rounded-xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }} data-testid="ratings-section">
            <h3 className="text-sm font-semibold text-white font-display mb-3">Rating Breakdown</h3>
            {avgStyle ? (
              <div className="space-y-2.5">
                {[["Punctuality", avgStyle.punctuality], ["Gear Handling", avgStyle.gear_handling], ["Teamwork", avgStyle.teamwork]].map(([label, val]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400 font-display">{label}</span>
                      <span className="text-amber-400 font-display">{val}/5</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-full rounded-full" style={{ width: `${(val / 5) * 100}%`, background: "#F59E0B" }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-zinc-600 mt-2">{ratings.total_ratings} anonymous review{ratings.total_ratings !== 1 ? "s" : ""}</p>
              </div>
            ) : <p className="text-xs text-zinc-600 text-center py-4">No ratings yet</p>}
          </div>

          {/* Gear Vault */}
          {profile.gear_vault?.length > 0 && (
            <div className="p-5 rounded-xl border md:col-span-2" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
              <h3 className="text-sm font-semibold text-white font-display mb-3 flex items-center gap-2">
                <Camera size={14} className="text-amber-500" /> Gear Vault
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
      </div>
    </Layout>
  );
}
