import React from "react";
import {
  Shield, MapPin, Star, User, Camera, UserPlus, UserCheck,
  Phone, MessageCircle, Pencil, Upload, Instagram, Globe, Wallet, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileHeader({
  profile, isOwn, connectionStatus, ratings,
  onEdit, onConnect, onDocDialog, onAvatarUpdate,
}) {
  const { api, refreshUser } = useAuth();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/uploads/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onAvatarUpdate(res.data.url);
      await refreshUser();
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white" data-testid="profile-header">
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-100 border-2 border-slate-200">
            {profile.profile_image
              ? <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" />
              : <User size={32} className="text-slate-400" />
            }
          </div>
          {isOwn && (
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center cursor-pointer shadow-md transition-colors"
              title="Change profile picture"
            >
              <Camera size={13} className="text-white" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-slate-900 font-display">{profile.full_name}</h2>
            {profile.is_verified && (
              <span data-testid="verified-badge" className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                <Shield size={10} /> Verified
              </span>
            )}
            {profile.is_standby && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Standby</span>}
            {profile.is_ghost_mode && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Ghost Mode</span>}
          </div>

          {profile.username && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-violet-500 font-mono font-semibold">@{profile.username}</span>
              {isOwn && (
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`); toast.success("Profile link copied!"); }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                  title="Copy profile link"
                >
                  <Link2 size={9} /> copy link
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
            {profile.primary_role && <span className="font-display text-orange-500">{profile.primary_role}</span>}
            {profile.secondary_role && <span className="text-slate-400">• {profile.secondary_role}</span>}
            {profile.years_of_experience && <span className="text-xs text-slate-400">{profile.years_of_experience}y exp</span>}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
            {(profile.location || profile.city) && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />{profile.area ? `${profile.area}, ` : ""}{profile.location}{profile.state ? `, ${profile.state}` : ""}
              </span>
            )}
            {ratings.avg_rating && (
              <span className="flex items-center gap-1">
                <Star size={11} className="text-amber-400" />
                {ratings.avg_rating.toFixed(1)} ({ratings.total_ratings})
              </span>
            )}
            {profile.primary_rate > 0 && <span>₹{profile.primary_rate?.toLocaleString("en-IN")}/day</span>}
          </div>

          {profile.bio && <p className="text-sm text-slate-600 mt-3 leading-relaxed">{profile.bio}</p>}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {profile.instagram_url && (
              <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-pink-500 hover:underline">
                <Instagram size={12} /> Instagram
              </a>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                <Globe size={12} /> Website
              </a>
            )}
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
                <Link2 size={12} /> LinkedIn
              </a>
            )}
            {profile.upi_id && (
              isOwn ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Wallet size={12} /> {profile.upi_id}
                </span>
              ) : (
                <a
                  href={`upi://pay?pa=${encodeURIComponent(profile.upi_id)}&pn=${encodeURIComponent(profile.full_name)}&cu=INR`}
                  data-testid="upi-pay-btn"
                  className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors font-display"
                >
                  <Wallet size={12} /> Pay Now
                </a>
              )
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {isOwn ? (
          <>
            <Button size="sm" data-testid="edit-profile-btn" onClick={onEdit} style={{ background: "#F97316", color: "#fff" }} className="font-display gap-1.5">
              <Pencil size={13} /> Edit Profile
            </Button>
            {profile.verification_status !== "approved" && (
              <Button size="sm" data-testid="submit-documents-btn" variant="outline" onClick={onDocDialog} className="font-display gap-1.5 border-blue-200 text-blue-600">
                <Upload size={13} />
                {profile.verification_status === "not_submitted" ? "Submit for Verification" :
                  profile.verification_status === "rejected" ? "Resubmit Documents" : "Pending Review"}
              </Button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {connectionStatus === "connected" ? (
              <>
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-500" disabled data-testid="connected-badge">
                  <UserCheck size={14} className="mr-1.5 text-emerald-500" /> Connected
                </Button>
                {(profile.phone || profile.whatsapp_number) && (
                  <a href={`tel:${profile.phone || profile.whatsapp_number}`} data-testid="call-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: "#3B82F6" }} title={`Call ${profile.full_name}`}>
                    <Phone size={13} /> Call
                  </a>
                )}
                {(profile.whatsapp_number || profile.phone) && (
                  <a
                    href={`https://wa.me/${(profile.whatsapp_number || profile.phone).replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(profile.full_name)}%2C%20I%20found%20your%20profile%20on%20Photoo!`}
                    target="_blank" rel="noopener noreferrer" data-testid="whatsapp-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: "#25D366" }} title={`WhatsApp ${profile.full_name}`}>
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
              </>
            ) : connectionStatus === "pending" ? (
              <Button size="sm" variant="outline" className="border-slate-200 text-slate-400" disabled data-testid="pending-connection-badge">
                Request Sent
              </Button>
            ) : (
              <Button size="sm" data-testid="connect-btn" onClick={onConnect} style={{ background: "#F97316", color: "#fff" }} className="font-display font-semibold">
                <UserPlus size={14} className="mr-1.5" /> Connect
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
