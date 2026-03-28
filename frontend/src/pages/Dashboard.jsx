import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Briefcase, Bell, Star, Shield, ChevronRight, CheckCircle, Clock, XCircle, AlertCircle, User, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP = {
  not_submitted: { label: "ID Not Submitted", color: "bg-zinc-700 text-zinc-300", icon: AlertCircle },
  pending: { label: "Pending Verification", color: "bg-amber-500/20 text-amber-400", icon: Clock },
  approved: { label: "Verified Professional", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  rejected: { label: "Verification Rejected", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

const NOTIF_ICONS = { invite: Bell, accepted: CheckCircle, rejected: XCircle, counter: Zap, connection_request: User, connection_accepted: User, wallet_credit: Wallet, verification: Shield, penalty: AlertCircle };

export default function Dashboard() {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [ratingModal, setRatingModal] = useState(null); // { gig, users_to_rate, currentIdx }
  const [ratingForm, setRatingForm] = useState({ punctuality: 3, gear_handling: 3, teamwork: 3, notes: "" });
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, notifRes, gigRes, ratingRes] = await Promise.all([
          api.get("/gigs/invites/received"),
          api.get("/notifications"),
          api.get("/gigs"),
          api.get("/ratings/pending"),
        ]);
        setInvites(invRes.data.filter(i => i.status === "pending").slice(0, 3));
        setNotifications(notifRes.data.slice(0, 5));
        setGigs(gigRes.data.filter(g => g.status === "active").slice(0, 3));
        setPendingRatings(ratingRes.data || []);
      } catch { /* noop */ } finally { setLoading(false); }
    };
    load();
  }, []);

  const openRatingModal = (item) => {
    setRatingModal({ ...item, currentIdx: 0 });
    setRatingForm({ punctuality: 3, gear_handling: 3, teamwork: 3, notes: "" });
  };

  const handleSubmitRating = async () => {
    if (!ratingModal) return;
    const userToRate = ratingModal.users_to_rate[ratingModal.currentIdx];
    setSubmittingRating(true);
    try {
      await api.post("/ratings", {
        gig_id: ratingModal.gig.id,
        rated_user_id: userToRate.user_id,
        punctuality: ratingForm.punctuality,
        gear_handling: ratingForm.gear_handling,
        teamwork: ratingForm.teamwork,
        notes: ratingForm.notes || null,
      });
      toast.success(`Rated ${userToRate.full_name}!`);

      const nextIdx = ratingModal.currentIdx + 1;
      if (nextIdx < ratingModal.users_to_rate.length) {
        // Rate next person in same gig
        setRatingModal(m => ({ ...m, currentIdx: nextIdx }));
        setRatingForm({ punctuality: 3, gear_handling: 3, teamwork: 3, notes: "" });
      } else {
        // All rated for this gig — remove from pending list
        setRatingModal(null);
        setPendingRatings(pr => pr.filter(r => r.gig.id !== ratingModal.gig.id));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit rating");
    } finally {
      setSubmittingRating(false); }
  };

  const RatingSlider = ({ label, field }) => (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-zinc-400 font-display">{label}</span>
        <span className="text-amber-400 font-bold font-display">{ratingForm[field]}/5</span>
      </div>
      <input
        type="range" min="1" max="5" step="1"
        value={ratingForm[field]}
        onChange={e => setRatingForm(f => ({ ...f, [field]: parseInt(e.target.value) }))}
        data-testid={`rating-slider-${field}`}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "#F59E0B" }}
      />
      <div className="flex justify-between text-[9px] text-zinc-700 mt-1 font-display">
        <span>Poor</span><span>Average</span><span>Excellent</span>
      </div>
    </div>
  );

  const status = STATUS_MAP[user?.verification_status || "not_submitted"];
  const StatusIcon = status.icon;

  const StatCard = ({ icon: Icon, label, value, sub, to, color = "#F59E0B" }) => (
    <Link to={to || "#"} className="p-5 rounded-xl border card-hover block" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }} data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}1A` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <ChevronRight size={14} className="text-zinc-600" />
      </div>
      <p className="text-2xl font-bold text-white font-display">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5 font-display">{label}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </Link>
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-white font-display font-semibold">
              Welcome back, {user?.full_name?.split(" ")[0]}
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-display ${status.color}`}>
            <StatusIcon size={12} />
            {status.label}
          </div>
        </div>

        {/* Verification banner */}
        {user?.verification_status === "not_submitted" && (
          <div className="p-4 rounded-xl border flex items-center justify-between gap-4" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)" }}>
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white font-display">Complete your verification</p>
                <p className="text-xs text-zinc-400">Upload your government ID to get the verified badge and start booking.</p>
              </div>
            </div>
            <Button size="sm" data-testid="complete-verification-btn" onClick={() => navigate("/onboarding")} style={{ background: "#F59E0B", color: "#000" }} className="flex-shrink-0 text-xs font-display font-semibold">
              Verify Now
            </Button>
          </div>
        )}

        {/* Post-event Rating Prompt */}
        {pendingRatings.length > 0 && (
          <div className="rounded-xl border" style={{ background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.25)" }}>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <Star size={17} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white font-display">
                    Rate your crew — {pendingRatings.reduce((n, r) => n + r.users_to_rate.length, 0)} review{pendingRatings.reduce((n, r) => n + r.users_to_rate.length, 0) !== 1 ? "s" : ""} pending
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">Help build trust in the community by rating your collaborators</p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {pendingRatings.map(item => (
                <div key={item.gig.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-display font-medium truncate">{item.gig.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.users_to_rate.length} person{item.users_to_rate.length !== 1 ? "s" : ""} to rate: {item.users_to_rate.map(u => u.full_name).join(", ")}</p>
                  </div>
                  <Button
                    size="sm"
                    data-testid={`rate-gig-btn-${item.gig.id}`}
                    onClick={() => openRatingModal(item)}
                    className="ml-3 flex-shrink-0 text-xs font-display"
                    style={{ background: "#8B5CF6", color: "#fff" }}
                  >
                    Rate Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Wallet} label="Wallet Balance" value={`₹${user?.wallet_balance?.toFixed(0) || "0"}`} sub={user?.subscription_plan !== "free" ? `${user?.subscription_plan} plan` : "Free plan"} to="/wallet" />
          <StatCard icon={Briefcase} label="Active Gigs" value={gigs.length} to="/gigs" />
          <StatCard icon={Bell} label="Pending Invites" value={invites.length} to="/gigs" color="#3B82F6" />
          <StatCard icon={Star} label="Rating" value={user?.avg_rating ? `${user.avg_rating.toFixed(1)}★` : "—"} sub={user?.total_ratings ? `${user.total_ratings} reviews` : "No reviews yet"} to={`/profile/${user?.id}`} color="#10B981" />
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pending Invites */}
          <div className="p-5 rounded-xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white font-display">Pending Invites</h3>
              <Link to="/gigs" className="text-xs text-amber-400 hover:text-amber-300 font-display">View all</Link>
            </div>
            {invites.length === 0 ? (
              <p className="text-xs text-zinc-600 py-4 text-center">No pending invites</p>
            ) : (
              <div className="space-y-3">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#1C1C1F" }}>
                    <div>
                      <p className="text-sm text-white font-display font-medium">{inv.gig?.title || "Untitled Gig"}</p>
                      <p className="text-xs text-zinc-400">{inv.role} • ₹{inv.proposed_fee?.toLocaleString("en-IN")}</p>
                    </div>
                    <Button size="sm" data-testid={`invite-view-${inv.id}`} onClick={() => navigate(`/gigs/${inv.gig_id}`)} variant="outline" className="text-xs border-white/10 text-zinc-300 hover:text-white">
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="p-5 rounded-xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white font-display">Recent Activity</h3>
              <Link to="/notifications" className="text-xs text-amber-400 hover:text-amber-300 font-display">View all</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-zinc-600 py-4 text-center">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => {
                  const Icon = NOTIF_ICONS[n.type] || Bell;
                  return (
                    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg ${!n.is_read ? "bg-amber-500/5 border border-amber-500/10" : ""}`} style={{ background: n.is_read ? "#1C1C1F" : undefined }}>
                      <Icon size={14} className={`mt-0.5 flex-shrink-0 ${n.is_read ? "text-zinc-500" : "text-amber-400"}`} />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-display font-medium truncate">{n.title}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{n.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Gigs */}
          <div className="p-5 rounded-xl border lg:col-span-2" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white font-display">Active Gigs</h3>
              <div className="flex gap-2">
                <Link to="/gigs" className="text-xs text-amber-400 hover:text-amber-300 font-display">View all</Link>
                <Button size="sm" data-testid="create-gig-btn" onClick={() => navigate("/gigs")} style={{ background: "#F59E0B", color: "#000" }} className="text-xs font-display font-semibold">
                  + New Gig
                </Button>
              </div>
            </div>
            {gigs.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase size={28} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No active gigs. Create one to assemble your crew.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {gigs.map(g => (
                  <Link key={g.id} to={`/gigs/${g.id}`} data-testid={`gig-card-${g.id}`} className="p-4 rounded-lg border card-hover" style={{ background: "#1C1C1F", borderColor: "rgba(255,255,255,0.05)" }}>
                    <p className="text-sm text-white font-display font-medium truncate">{g.title}</p>
                    <p className="text-xs text-zinc-400 mt-1">{g.sessions?.length || 0} sessions</p>
                    <span className="inline-flex items-center mt-2 text-[10px] px-2 py-0.5 rounded-full font-display" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>Active</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <Dialog open={true} onOpenChange={() => setRatingModal(null)}>
          <DialogContent className="max-w-md" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.1)" }}>
            <DialogHeader>
              <DialogTitle className="text-white font-display flex items-center gap-2">
                <Star size={16} className="text-purple-400" />
                Rate your collaborator
              </DialogTitle>
            </DialogHeader>

            {/* Progress */}
            {ratingModal.users_to_rate.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-display">
                <span>{ratingModal.currentIdx + 1} of {ratingModal.users_to_rate.length}</span>
                <div className="flex-1 h-1 rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${((ratingModal.currentIdx + 1) / ratingModal.users_to_rate.length) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Person being rated */}
            <div className="p-3 rounded-lg" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <p className="text-sm font-semibold text-white font-display">
                {ratingModal.users_to_rate[ratingModal.currentIdx]?.full_name}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {ratingModal.users_to_rate[ratingModal.currentIdx]?.role} · {ratingModal.gig.title}
              </p>
            </div>

            {/* Rating sliders */}
            <div className="space-y-4 mt-2">
              <RatingSlider label="Punctuality" field="punctuality" />
              <RatingSlider label="Gear Handling" field="gear_handling" />
              <RatingSlider label="Teamwork" field="teamwork" />
            </div>

            {/* Private note */}
            <div>
              <label className="text-xs text-zinc-400 font-display block mb-1.5">Private Note (optional)</label>
              <textarea
                data-testid="rating-notes-input"
                className="w-full bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 text-sm rounded-lg px-3 py-2 outline-none focus:border-purple-500/50 resize-none h-16"
                placeholder="Private note — only you can see this"
                value={ratingForm.notes}
                onChange={e => setRatingForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRatingModal(null)} className="flex-1 border-white/10 text-zinc-400 text-xs">
                Skip
              </Button>
              <Button
                data-testid="submit-rating-btn"
                onClick={handleSubmitRating}
                disabled={submittingRating}
                className="flex-1 text-xs font-display"
                style={{ background: "#8B5CF6", color: "#fff" }}
              >
                {submittingRating ? "Submitting…" : ratingModal.currentIdx + 1 < ratingModal.users_to_rate.length ? "Rate & Next" : "Submit Rating"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
