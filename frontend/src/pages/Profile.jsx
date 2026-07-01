import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, MapPin, Star, Camera, User, UserPlus, UserCheck,
  StickyNote, Save, Trash2, Pencil, Plus, X, Upload,
  Instagram, Globe, Wallet, Link2, ChevronDown, ChevronLeft, ChevronRight,
  Phone, MessageCircle, Loader2, CheckCircle2, Sparkles, Wand2, Link2 as Link2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { fetchPincodeData } from "@/utils/pincode";

// ── Constants ──────────────────────────────────────────────────────────────────

const CAT_COLORS = {
  Camera: "#3B82F6", Lens: "#8B5CF6", Lighting: "#F59E0B",
  Drone: "#10B981", Audio: "#EC4899", Accessories: "#F97316", Other: "#6B7280",
};
const GEAR_CATEGORIES = ["Camera", "Lens", "Lighting", "Drone", "Audio", "Accessories", "Other"];

const INDIAN_CITIES = [
  "Mumbai","Delhi","Bengaluru","Hyderabad","Ahmedabad","Chennai","Kolkata","Surat","Pune","Jaipur",
  "Lucknow","Kanpur","Nagpur","Indore","Thane","Bhopal","Visakhapatnam","Patna","Vadodara","Ghaziabad",
  "Ludhiana","Agra","Nashik","Faridabad","Meerut","Rajkot","Varanasi","Srinagar","Aurangabad","Dhanbad",
  "Amritsar","Allahabad","Ranchi","Howrah","Coimbatore","Jodhpur","Madurai","Raipur","Kochi","Chandigarh",
  "Guwahati","Solapur","Hubli","Tiruchirappalli","Bareilly","Moradabad","Mysore","Gurgaon","Noida","Dehradun",
  "Bhubaneswar","Thiruvananthapuram","Udaipur","Jabalpur","Vijayawada","Jamshedpur","Kolhapur","Ajmer",
  "Mangaluru","Pondicherry","Siliguri","Kozhikode","Jalandhar","Bhilai","Cuttack","Bikaner","Warangal",
  "Guntur","Bhavnagar","Gwalior","Asansol","Aligarh","Saharanpur","Gorakhpur","Firozabad","Jhansi",
  "Navi Mumbai","Secunderabad","Pimpri-Chinchwad","Jammu","Rourkela","Bilaspur","Dhule",
];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Chandigarh","Delhi","Jammu & Kashmir",
  "Ladakh","Puducherry",
];

// ── City Search Dropdown ───────────────────────────────────────────────────────
function CitySelect({ value, onChange, inputClass }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = INDIAN_CITIES.filter(c =>
    c.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  useEffect(() => { setQuery(value || ""); }, [value]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          data-testid="city-input"
          className={`w-full pr-8 ${inputClass}`}
          placeholder="Search city..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        />
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <li
              key={c}
              className="px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-600 cursor-pointer font-display"
              onMouseDown={() => { onChange(c); setQuery(c); setOpen(false); }}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { id, username: usernameParam } = useParams();
  const profileIdentifier = usernameParam || id;   // supports /profile/:id and /u/:username
  const { user, api, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState({ avg_rating: null, total_ratings: 0, ratings: [] });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Username setup state
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "available" | "taken" | "invalid"
  const [usernameSaving, setUsernameSaving] = useState(false);
  const usernameTimer = useRef(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState("idle"); // "idle"|"loading"|"valid"|"invalid"

  // Change Password state
  const [showChangePass, setShowChangePass] = useState(false);
  const [changePassForm, setChangePassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [changePassLoading, setChangePassLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!changePassForm.current) { toast.error("Enter your current password"); return; }
    if (changePassForm.newPass.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (changePassForm.newPass !== changePassForm.confirm) { toast.error("Passwords don't match"); return; }
    setChangePassLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: changePassForm.current,
        new_password: changePassForm.newPass,
      });
      toast.success("Password changed successfully");
      setShowChangePass(false);
      setChangePassForm({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally {
      setChangePassLoading(false);
    }
  };

  const handleProfilePincodeBlur = async (pincode) => {
    if (!pincode || String(pincode).length !== 6) { setPincodeStatus("idle"); return; }
    setPincodeStatus("loading");
    const result = await fetchPincodeData(pincode);
    if (!result) { setPincodeStatus("idle"); return; }
    if (result.valid) {
      setEditForm(p => ({
        ...p,
        state: result.state || p.state,
        location: result.city || p.location,
      }));
      setPincodeStatus("valid");
      toast.success(`Pincode found: ${result.city}, ${result.state}`);
    } else {
      setPincodeStatus("invalid");
    }
  };

  // Notes
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteExists, setNoteExists] = useState(false);

  // Gear
  const [gearDialog, setGearDialog] = useState(null); // null | { mode:'add'|'edit', item? }
  const [gearStep, setGearStep] = useState(0); // 0=category, 1=select or custom
  const [gearForm, setGearForm] = useState({ name: "", category: "Camera", brand: "", model_number: "", is_custom: false });
  const [gearSaving, setGearSaving] = useState(false);
  const [masterGear, setMasterGear] = useState([]);

  // AI gear normalization
  const [aiNorm, setAiNorm] = useState(null);       // { normalized_name, brand, category, confidence, catalogue_match }
  const [aiNormLoading, setAiNormLoading] = useState(false);
  const aiNormTimer = useRef(null);

  // Doc resubmit
  const [docDialog, setDocDialog] = useState(false);
  const [docForm, setDocForm] = useState({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
  const [docSaving, setDocSaving] = useState(false);

  const isOwn = user?.id === id || (!id && !usernameParam);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, ratingsRes] = await Promise.all([
          api.get(`/users/${profileIdentifier}`),
          api.get(`/ratings/user/${profileIdentifier}`),
        ]);
        setProfile(userRes.data);
        const resolvedId = userRes.data.id;
        const ownProfile = user?.id === resolvedId;
        if (!ownProfile) {
          const conns = await api.get("/connections");
          const found = conns.data.find(c => c.user?.id === resolvedId);
          setConnectionStatus(found ? "connected" : null);
          // Only load notes if connected
          if (found) {
            setNoteLoading(true);
            try {
              const noteRes = await api.get(`/notes/${resolvedId}`);
              setNote(noteRes.data.content || "");
              setNoteExists(noteRes.data.exists || false);
            } catch { /* not connected or error */ }
            finally { setNoteLoading(false); }
          }
        }
        setRatings(ratingsRes.data);
        try {
          const metaRes = await api.get("/platform/gear-catalogue");
          setMasterGear(metaRes.data?.items || []);
        } catch { /* fallback */ }
      } catch { toast.error("Failed to load profile"); } finally { setLoading(false); }
    };
    load();
  }, [id, isOwn]);

  const startEdit = () => {
    setEditForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      whatsapp_number: profile.whatsapp_number || "",
      whatsapp_same_as_mobile: profile.whatsapp_number === profile.phone,
      area: profile.area || "",
      location: profile.location || "",
      state: profile.state || "",
      country: profile.country || "India",
      pincode: profile.pincode || "",
      bio: profile.bio || "",
      primary_role: profile.primary_role || "",
      secondary_role: profile.secondary_role || "",
      primary_rate: profile.primary_rate || "",
      secondary_rate: profile.secondary_rate || "",
      instagram_url: profile.instagram_url || "",
      linkedin_url: profile.linkedin_url || "",
      website_url: profile.website_url || "",
      upi_id: profile.upi_id || "",
      years_of_experience: profile.years_of_experience || "",
      style_tags: profile.style_tags || [],
      editing_ecosystem: profile.editing_ecosystem || [],
    });
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.whatsapp_same_as_mobile) payload.whatsapp_number = payload.phone;
      Object.keys(payload).forEach(k => { if (payload[k] === "") delete payload[k]; });
      if (payload.primary_rate) payload.primary_rate = parseFloat(payload.primary_rate);
      if (payload.secondary_rate) payload.secondary_rate = parseFloat(payload.secondary_rate);
      if (payload.years_of_experience) payload.years_of_experience = parseInt(payload.years_of_experience);
      const res = await api.put("/users/profile", payload);
      setProfile(res.data);
      await refreshUser();
      setEditing(false);
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

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
    } catch { toast.error("Failed to save note"); } finally { setNoteSaving(false); }
  };

  const handleDeleteNote = async () => {
    try {
      await api.delete(`/notes/${id}`);
      setNote(""); setNoteExists(false);
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
  };

  const openGearAdd = () => {
    setGearStep(0);
    setGearForm({ name: "", category: "Camera", brand: "", model_number: "", is_custom: false });
    setGearDialog({ mode: "add" });
  };

  const openGearEdit = (item) => {
    setGearForm({ name: item.name, category: item.category, brand: item.brand || "", model_number: item.model_number || "", is_custom: false });
    setGearDialog({ mode: "edit", item });
  };

  // ── AI gear name normalization (debounced) ─────────────────────────────────
  const fetchAiNorm = async (name) => {
    if (!name || name.trim().length < 3) { setAiNorm(null); setAiNormLoading(false); return; }
    setAiNormLoading(true);
    try {
      const res = await api.get(`/platform/gear-catalogue/normalize?name=${encodeURIComponent(name.trim())}`);
      const data = res.data;
      // Only show suggestion if it differs meaningfully from what was typed
      if (data.confidence >= 0.6 && data.is_photography_gear) {
        setAiNorm(data);
      } else {
        setAiNorm(null);
      }
    } catch { setAiNorm(null); }
    finally { setAiNormLoading(false); }
  };

  const handleGearNameChange = (value) => {
    setGearForm(p => ({ ...p, name: value }));
    setAiNorm(null);
    if (aiNormTimer.current) clearTimeout(aiNormTimer.current);
    if (value.trim().length >= 3) {
      aiNormTimer.current = setTimeout(() => fetchAiNorm(value), 700);
    }
  };

  const acceptAiSuggestion = () => {
    if (!aiNorm) return;
    setGearForm(p => ({
      ...p,
      name: aiNorm.normalized_name || p.name,
      brand: aiNorm.brand || p.brand,
      category: aiNorm.category && ["Camera","Lens","Lighting","Drone","Audio","Accessories","Other"].includes(aiNorm.category)
        ? aiNorm.category : p.category,
    }));
    setAiNorm(null);
  };

  // ── Username setup ────────────────────────────────────────────────────────────
  const checkUsername = async (val) => {
    if (!val || val.length < 3) { setUsernameStatus(null); return; }
    const isValid = /^[a-z][a-z0-9_]{2,19}$/.test(val.toLowerCase());
    if (!isValid) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    try {
      const res = await api.get(`/users/check-username/${val.toLowerCase()}`);
      setUsernameStatus(res.data.available ? "available" : "taken");
    } catch { setUsernameStatus(null); }
  };

  const handleUsernameInputChange = (val) => {
    setUsernameInput(val.toLowerCase().replace(/[^a-z0-9_]/g, ""));
    setUsernameStatus(null);
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.trim().length >= 3) {
      usernameTimer.current = setTimeout(() => checkUsername(val.trim().toLowerCase()), 600);
    }
  };

  const handleSaveUsername = async () => {
    if (usernameStatus !== "available") return;
    setUsernameSaving(true);
    try {
      const res = await api.post("/users/set-username", { username: usernameInput.toLowerCase() });
      setProfile(res.data);
      await refreshUser();
      toast.success(`@${usernameInput} set! Your profile is now at /u/${usernameInput}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save username");
    } finally { setUsernameSaving(false); }
  };

  const handleGearSave = async () => {
    const gearName = gearForm.name.trim();
    if (!gearName) { toast.error("Gear name required"); return; }
    if (!gearForm.category) { toast.error("Category required"); return; }
    setGearSaving(true);
    try {
      const payload = {
        name: gearName,
        category: gearForm.category,
        brand: gearForm.brand?.trim() || null,
        model_number: gearForm.model_number?.trim() || null,
      };

      if (gearDialog.mode === "add") {
        const res = await api.post("/users/gear", payload);
        setProfile(p => ({ ...p, gear_vault: [...(p.gear_vault || []), res.data] }));
        if (gearForm.is_custom) {
          try {
            const subRes = await api.post("/platform/gear-submissions", {
              name: gearName,
              category: gearForm.category,
              brand: gearForm.brand?.trim() || null,
            });
            if (subRes.data?.auto_approved) {
              toast.success("Gear added! ✨ AI auto-approved it — now in the master catalogue.");
            } else if (subRes.data?.already_in_catalogue) {
              toast.success("Gear added to your vault! (Already in master catalogue)");
            } else {
              toast.success("Gear added! Submitted for admin review to include in master catalogue.");
            }
          } catch {
            toast.success("Gear added to your vault!");
          }
        } else {
          toast.success("Gear added!");
        }
      } else {
        await api.put(`/users/gear/${gearDialog.item.id}`, payload);
        setProfile(p => ({
          ...p,
          gear_vault: p.gear_vault.map(g => g.id === gearDialog.item.id ? { ...g, ...payload } : g),
        }));
        toast.success("Gear updated");
      }
      setGearDialog(null);
      setGearStep(0);
    } catch { toast.error("Failed to save gear"); } finally { setGearSaving(false); }
  };

  const handleGearDelete = async (gearId) => {
    try {
      await api.delete(`/users/gear/${gearId}`);
      setProfile(p => ({ ...p, gear_vault: p.gear_vault.filter(g => g.id !== gearId) }));
      toast.success("Gear removed");
    } catch { toast.error("Failed to remove gear"); }
  };

  const handleDocSubmit = async () => {
    if (!docForm.govt_id_base64 || !docForm.selfie_base64) {
      toast.error("Please upload both documents"); return;
    }
    setDocSaving(true);
    try {
      await api.post("/users/id-upload", docForm);
      setProfile(p => ({ ...p, verification_status: "pending" }));
      setDocDialog(false);
      toast.success("Documents submitted! Admin will review within 24 hours.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit documents");
    } finally { setDocSaving(false); }
  };

  const toB64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFileChange = async (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB"); return; }
    try {
      const b64 = await toB64(file);
      setDocForm(p => ({ ...p, [field]: b64 }));
      toast.success("File loaded");
    } catch { toast.error("Failed to read file"); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none transition-colors";
  const labelClass = "text-xs font-display text-slate-600 mb-1 block";

  const avgStyle = ratings.ratings.length ? {
    punctuality: (ratings.ratings.reduce((s, r) => s + r.punctuality, 0) / ratings.ratings.length).toFixed(1),
    gear_handling: (ratings.ratings.reduce((s, r) => s + r.gear_handling, 0) / ratings.ratings.length).toFixed(1),
    teamwork: (ratings.ratings.reduce((s, r) => s + r.teamwork, 0) / ratings.ratings.length).toFixed(1),
  } : null;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );
  if (!profile) return <Layout><p className="text-slate-400 text-center mt-20">Profile not found.</p></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header Card */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white" data-testid="profile-header">
          <div className="flex items-start gap-5">
            {/* Avatar — clickable upload for own profile */}
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        const res = await api.post("/uploads/profile-picture", formData, {
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        await refreshUser();
                        setProfile(p => ({ ...p, profile_image: res.data.url }));
                        toast.success("Profile picture updated!");
                      } catch (err) {
                        toast.error(err.response?.data?.detail || "Upload failed");
                      }
                      e.target.value = "";
                    }}
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
              {/* @username + profile link */}
              {profile.username && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-violet-500 font-mono font-semibold">@{profile.username}</span>
                  {isOwn && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`); toast.success("Profile link copied!"); }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                      title="Copy profile link"
                    >
                      <Link2Icon size={9} /> copy link
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
              {/* Social Links */}
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
                {/* UPI: show Pay Now button to others, own UPI ID to self */}
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
                <Button
                  size="sm"
                  data-testid="edit-profile-btn"
                  onClick={startEdit}
                  style={{ background: "#F97316", color: "#fff" }}
                  className="font-display gap-1.5"
                >
                  <Pencil size={13} /> Edit Profile
                </Button>
                {profile.verification_status !== "approved" && (
                  <Button
                    size="sm"
                    data-testid="submit-documents-btn"
                    variant="outline"
                    onClick={() => setDocDialog(true)}
                    className="font-display gap-1.5 border-blue-200 text-blue-600"
                  >
                    <Upload size={13} />
                    {profile.verification_status === "not_submitted" ? "Submit for Verification" :
                      profile.verification_status === "rejected" ? "Resubmit Documents" :
                        "Pending Review"}
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {/* WhatsApp button — visible to all viewers regardless of connection status */}
                {(profile.whatsapp_number || profile.phone) && (
                  <a
                    href={`https://wa.me/${(profile.whatsapp_number || profile.phone).replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(profile.full_name)}%2C%20I%20found%20your%20profile%20on%20Photoo!`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="whatsapp-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: "#25D366" }}
                    title={`WhatsApp ${profile.full_name}`}
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                {connectionStatus === "connected" ? (
                  <>
                    <Button size="sm" variant="outline" className="border-slate-200 text-slate-500" disabled data-testid="connected-badge">
                      <UserCheck size={14} className="mr-1.5 text-emerald-500" /> Connected
                    </Button>
                    {/* Call button — only for connected users */}
                    {(profile.phone || profile.whatsapp_number) && (
                      <a
                        href={`tel:${profile.phone || profile.whatsapp_number}`}
                        data-testid="call-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-medium text-white transition-opacity hover:opacity-90"
                        style={{ background: "#3B82F6" }}
                        title={`Call ${profile.full_name}`}
                      >
                        <Phone size={13} /> Call
                      </a>
                    )}
                  </>
                ) : connectionStatus === "pending" ? (
                  <Button size="sm" variant="outline" className="border-slate-200 text-slate-400" disabled data-testid="pending-connection-badge">
                    Request Sent
                  </Button>
                ) : (
                  <Button size="sm" data-testid="connect-btn" onClick={handleConnect} style={{ background: "#F97316", color: "#fff" }} className="font-display font-semibold">
                    <UserPlus size={14} className="mr-1.5" /> Connect
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Style & Editing */}
          {(profile.style_tags?.length > 0 || profile.editing_ecosystem?.length > 0) && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white">
              <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Style & Workflow</h3>
              {profile.style_tags?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1.5 font-display uppercase tracking-wide">Shooting Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.style_tags.map(t => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full border font-display border-orange-200 text-orange-600 bg-orange-50">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.editing_ecosystem?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5 font-display uppercase tracking-wide">Editing Software</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.editing_ecosystem.map(e => (
                      <span key={e} className="text-xs px-2.5 py-1 rounded-full border font-display border-slate-200 text-slate-600 bg-slate-50">{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ratings */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white" data-testid="ratings-section">
            <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Rating Breakdown</h3>
            {avgStyle ? (
              <div className="space-y-2.5">
                {[["Punctuality", avgStyle.punctuality], ["Gear Handling", avgStyle.gear_handling], ["Teamwork", avgStyle.teamwork]].map(([label, val]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-display">{label}</span>
                      <span className="text-orange-500 font-display">{val}/5</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${(val / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-400 mt-2">{ratings.total_ratings} anonymous review{ratings.total_ratings !== 1 ? "s" : ""}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No ratings yet</p>
            )}
          </div>
        </div>

        {/* ── Username setup (own profile, no username yet) ──────────────────── */}
        {isOwn && !profile.username && (
          <div className="p-5 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50">
            <div className="flex items-center gap-2 mb-2">
              <Link2Icon size={14} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-900 font-display">Claim your @username</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">One-time · cannot be changed</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Get a clean profile URL like <span className="font-mono text-violet-600">/u/johndoe</span> instead of a long ID.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">@</span>
                <input
                  data-testid="username-input"
                  className="w-full pl-6 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-violet-400 focus:outline-none font-mono"
                  placeholder="yourname"
                  value={usernameInput}
                  maxLength={20}
                  onChange={e => handleUsernameInputChange(e.target.value)}
                />
                {usernameStatus === "checking" && (
                  <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                )}
                {usernameStatus === "taken" && (
                  <X size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400" />
                )}
              </div>
              <Button
                size="sm"
                disabled={usernameStatus !== "available" || usernameSaving}
                onClick={handleSaveUsername}
                className="font-display font-semibold text-white text-xs"
                style={{ background: usernameStatus === "available" ? "#8B5CF6" : undefined }}
              >
                {usernameSaving ? <Loader2 size={12} className="animate-spin" /> : "Claim"}
              </Button>
            </div>
            {usernameStatus === "taken" && <p className="text-xs text-red-500 mt-1.5">That username is taken. Try another.</p>}
            {usernameStatus === "invalid" && <p className="text-xs text-amber-500 mt-1.5">3–20 chars, start with a letter, lowercase letters/numbers/underscores only.</p>}
            {usernameStatus === "available" && <p className="text-xs text-emerald-600 mt-1.5">✓ @{usernameInput} is available!</p>}
          </div>
        )}

        {/* Gear Vault */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 font-display flex items-center gap-2">
              <Camera size={14} className="text-orange-500" /> Gear Vault
              <span className="text-xs font-normal text-slate-400">({profile.gear_vault?.length || 0})</span>
            </h3>
            {isOwn && (
              <Button size="sm" data-testid="add-gear-btn" onClick={openGearAdd}
                className="h-7 text-xs font-display gap-1 text-white" style={{ background: "#F97316" }}>
                <Plus size={12} /> Add Gear
              </Button>
            )}
          </div>
          {(profile.gear_vault?.length || 0) === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No gear listed yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.gear_vault.map((g) => (
                <div
                  key={g.id || g.name}
                  data-testid={`gear-item-${g.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-display group"
                  style={{
                    borderColor: `${CAT_COLORS[g.category] || "#6B7280"}40`,
                    background: `${CAT_COLORS[g.category] || "#6B7280"}0D`,
                    color: CAT_COLORS[g.category] || "#6B7280",
                  }}
                >
                  <span>{g.name}</span>
                  {g.brand && <span className="opacity-50">· {g.brand}</span>}
                  <span className="text-[10px] opacity-50">{g.category}</span>
                  {isOwn && (
                    <div className="hidden group-hover:flex items-center gap-1 ml-1">
                      <button onClick={() => openGearEdit(g)} className="hover:opacity-80" title="Edit">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleGearDelete(g.id)} className="hover:opacity-80" title="Delete">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Private Lead Notes — connections only */}
        {!isOwn && connectionStatus === "connected" && (
          <div data-testid="lead-notes-section" className="p-5 rounded-xl border border-orange-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote size={14} className="text-orange-500" />
              <h3 className="text-sm font-semibold text-slate-900 font-display">Private Notes</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-display ml-auto bg-orange-50 text-orange-500">Only visible to you</span>
            </div>
            {noteLoading ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-orange-400/40 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Loading…</span>
              </div>
            ) : (
              <>
                <textarea
                  data-testid="lead-note-input"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 resize-none h-24 transition-colors"
                  placeholder={`Private notes about ${profile.full_name}…`}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" data-testid="save-note-btn" onClick={handleSaveNote} disabled={noteSaving || !note.trim()}
                    className="gap-1.5 text-xs font-display" style={{ background: "#F97316", color: "#fff" }}>
                    <Save size={12} />{noteSaving ? "Saving…" : "Save Note"}
                  </Button>
                  {noteExists && (
                    <Button size="sm" variant="outline" data-testid="delete-note-btn" onClick={handleDeleteNote}
                      className="gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50 font-display">
                      <Trash2 size={12} /> Delete
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Profile Dialog ──────────────────────────────────────────── */}
      <Dialog open={editing} onOpenChange={() => setEditing(false)}>
        <DialogContent className="bg-white border-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {/* Basic Info */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Basic Info</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input data-testid="edit-full-name" className={inputClass} value={editForm.full_name || ""} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Years of Experience</label>
                  <input data-testid="edit-years-exp" type="number" min="0" max="50" className={inputClass} placeholder="e.g. 5" value={editForm.years_of_experience || ""} onChange={e => setEditForm(p => ({ ...p, years_of_experience: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Short Bio</label>
                <textarea data-testid="edit-bio" className={`${inputClass} resize-none h-20`} placeholder="Tell others about your work style…" value={editForm.bio || ""} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} />
              </div>
            </section>

            {/* Contact */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Mobile Number *</label>
                  <input data-testid="edit-phone" className={inputClass} placeholder="9876543210" value={editForm.phone || ""} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp Number</label>
                  <input
                    data-testid="edit-whatsapp"
                    className={`${inputClass} ${editForm.whatsapp_same_as_mobile ? "opacity-50" : ""}`}
                    disabled={editForm.whatsapp_same_as_mobile}
                    placeholder="Same as mobile"
                    value={editForm.whatsapp_same_as_mobile ? editForm.phone : (editForm.whatsapp_number || "")}
                    onChange={e => setEditForm(p => ({ ...p, whatsapp_number: e.target.value }))}
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="whatsapp-same-as-mobile"
                      checked={editForm.whatsapp_same_as_mobile || false}
                      onChange={e => setEditForm(p => ({ ...p, whatsapp_same_as_mobile: e.target.checked }))}
                      className="accent-orange-500"
                    />
                    <span className="text-xs text-slate-500">Same as mobile</span>
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>UPI ID</label>
                <input data-testid="edit-upi" className={inputClass} placeholder="yourname@upi" value={editForm.upi_id || ""} onChange={e => setEditForm(p => ({ ...p, upi_id: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">Others can send payments directly to you via UPI apps</p>
              </div>
            </section>

            {/* Location */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Area / Neighbourhood</label>
                  <input data-testid="edit-area" className={inputClass} placeholder="Bandra West" value={editForm.area || ""} onChange={e => setEditForm(p => ({ ...p, area: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>City *</label>
                  <CitySelect value={editForm.location || ""} onChange={v => setEditForm(p => ({ ...p, location: v }))} inputClass={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <select data-testid="edit-state" className={inputClass} value={editForm.state || ""} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))}>
                    <option value="">Select state…</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Pincode</label>
                  <div className="relative">
                    <input
                      data-testid="edit-pincode"
                      className={`${inputClass} ${pincodeStatus === "valid" ? "border-green-400 pr-7" : pincodeStatus === "invalid" ? "border-red-400" : ""}`}
                      placeholder="400001"
                      maxLength={6}
                      value={editForm.pincode || ""}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setEditForm(p => ({ ...p, pincode: v }));
                        setPincodeStatus("idle");
                      }}
                      onBlur={e => handleProfilePincodeBlur(e.target.value)}
                    />
                    {pincodeStatus === "loading" && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                    {pincodeStatus === "valid" && <CheckCircle2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" />}
                    {pincodeStatus === "invalid" && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500 text-xs font-bold">✗</span>}
                  </div>
                  {pincodeStatus === "invalid" && <p className="text-xs text-red-500 mt-0.5">Invalid pincode</p>}
                </div>
              </div>
            </section>

            {/* Roles & Rates */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Roles & Rates (max 2)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Primary Role</label>
                  <RoleSelect value={editForm.primary_role || ""} onChange={v => setEditForm(p => ({ ...p, primary_role: v }))} api={api} inputClass={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Primary Day Rate (₹)</label>
                  <input data-testid="edit-primary-rate" type="number" className={inputClass} placeholder="15000" value={editForm.primary_rate || ""} onChange={e => setEditForm(p => ({ ...p, primary_rate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Secondary Role (optional)</label>
                  <RoleSelect value={editForm.secondary_role || ""} onChange={v => setEditForm(p => ({ ...p, secondary_role: v }))} api={api} inputClass={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Secondary Day Rate (₹)</label>
                  <input data-testid="edit-secondary-rate" type="number" className={inputClass} placeholder="10000" value={editForm.secondary_rate || ""} onChange={e => setEditForm(p => ({ ...p, secondary_rate: e.target.value }))} />
                </div>
              </div>
            </section>

            {/* Social & Links */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Social & Links</p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}><Instagram size={11} className="inline mr-1" />Instagram URL</label>
                  <input data-testid="edit-instagram" className={inputClass} placeholder="https://instagram.com/yourhandle" value={editForm.instagram_url || ""} onChange={e => setEditForm(p => ({ ...p, instagram_url: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}><Globe size={11} className="inline mr-1" />Website / Portfolio URL</label>
                  <input data-testid="edit-website" className={inputClass} placeholder="https://yoursite.com" value={editForm.website_url || ""} onChange={e => setEditForm(p => ({ ...p, website_url: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}><Link2 size={11} className="inline mr-1" />LinkedIn URL</label>
                  <input data-testid="edit-linkedin" className={inputClass} placeholder="https://linkedin.com/in/yourprofile" value={editForm.linkedin_url || ""} onChange={e => setEditForm(p => ({ ...p, linkedin_url: e.target.value }))} />
                </div>
              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="save-profile-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 font-display text-white"
                style={{ background: "#F97316" }}
              >
                {saving ? "Saving…" : <><Save size={14} className="mr-1.5" />Save Changes</>}
              </Button>
            </div>

            {/* Change Password link inside edit dialog */}
            <button
              type="button"
              data-testid="open-change-password-btn"
              onClick={() => { setEditing(false); setShowChangePass(true); }}
              className="w-full text-xs text-orange-500 hover:text-orange-600 font-medium mt-1 text-center"
            >
              Change Password
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ───────────────────────────────────────── */}
      <Dialog open={showChangePass} onOpenChange={setShowChangePass}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display text-base">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <label className="text-xs text-slate-600 font-display">Current Password</label>
              <input
                data-testid="change-pass-current"
                type="password"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
                placeholder="••••••••"
                value={changePassForm.current}
                onChange={e => setChangePassForm(p => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-display">New Password</label>
              <input
                data-testid="change-pass-new"
                type="password"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
                placeholder="Min 8 chars, letter + number"
                value={changePassForm.newPass}
                onChange={e => setChangePassForm(p => ({ ...p, newPass: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-display">Confirm New Password</label>
              <input
                data-testid="change-pass-confirm"
                type="password"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
                placeholder="Re-enter new password"
                value={changePassForm.confirm}
                onChange={e => setChangePassForm(p => ({ ...p, confirm: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-slate-200 text-slate-500" onClick={() => { setShowChangePass(false); setChangePassForm({ current: "", newPass: "", confirm: "" }); }}>
                Cancel
              </Button>
              <Button
                data-testid="change-pass-submit"
                className="flex-1 text-white font-display"
                style={{ background: "#F97316" }}
                onClick={handleChangePassword}
                disabled={changePassLoading}
              >
                {changePassLoading ? "Saving…" : "Update Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Gear Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!gearDialog} onOpenChange={() => { setGearDialog(null); setGearStep(0); setAiNorm(null); setAiNormLoading(false); if (aiNormTimer.current) clearTimeout(aiNormTimer.current); }}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {gearDialog?.mode === "add" && gearStep === 1 && (
                <button
                  onClick={() => {
                    setGearStep(0);
                    setGearForm(p => ({ ...p, name: "", brand: "", model_number: "", is_custom: false }));
                    setAiNorm(null);
                    if (aiNormTimer.current) clearTimeout(aiNormTimer.current);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors -ml-1 flex-shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <DialogTitle className="text-slate-900 font-display">
                {gearDialog?.mode === "edit" ? "Edit Gear" :
                 gearStep === 0 ? "Select Category" :
                 gearForm.is_custom ? "Add Custom Gear" :
                 `Select ${gearForm.category}`}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* ADD — Step 0: Category list */}
          {gearDialog?.mode === "add" && gearStep === 0 && (
            <div className="mt-2 space-y-1">
              {GEAR_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  data-testid={`cat-select-${cat}`}
                  onClick={() => {
                    setGearForm(p => ({ ...p, category: cat, name: "", brand: "", model_number: "", is_custom: false }));
                    setGearStep(1);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-display flex-shrink-0"
                      style={{ background: `${CAT_COLORS[cat] || "#6B7280"}15`, color: CAT_COLORS[cat] || "#6B7280" }}
                    >
                      {cat.slice(0, 3)}
                    </div>
                    <span className="text-sm font-display font-medium text-slate-800">{cat}</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}

          {/* ADD — Step 1: Gear list (not custom) */}
          {gearDialog?.mode === "add" && gearStep === 1 && !gearForm.is_custom && (
            <div className="mt-2 space-y-2">
              <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                {masterGear.filter(g => g.category === gearForm.category).map(g => (
                  <button
                    key={g.id || g.name}
                    data-testid={`gear-option-${(g.name || "").replace(/\s+/g, "-")}`}
                    onClick={() => setGearForm(p => ({ ...p, name: g.name, brand: g.brand || "", model_number: "" }))}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      gearForm.name === g.name
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`text-sm font-display font-medium ${gearForm.name === g.name ? "text-orange-700" : "text-slate-800"}`}>
                      {g.name}
                    </span>
                    {g.brand && <span className="text-xs text-slate-400 ml-2">· {g.brand}</span>}
                  </button>
                ))}
                {masterGear.filter(g => g.category === gearForm.category).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No catalogue items for {gearForm.category}</p>
                )}
                <button
                  data-testid="gear-other-option"
                  onClick={() => setGearForm(p => ({ ...p, name: "", brand: "", model_number: "", is_custom: true }))}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-orange-300 hover:text-orange-500 transition-all"
                >
                  + Other — add custom gear
                </button>
              </div>
              {gearForm.name && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div>
                    <label className={labelClass}>Model / Serial (optional)</label>
                    <input
                      data-testid="gear-model"
                      className={inputClass}
                      placeholder="e.g. SN123"
                      value={gearForm.model_number}
                      onChange={e => setGearForm(p => ({ ...p, model_number: e.target.value }))}
                    />
                  </div>
                  <Button
                    data-testid="save-gear-btn"
                    onClick={handleGearSave}
                    disabled={gearSaving}
                    className="w-full font-display text-white"
                    style={{ background: "#F97316" }}
                  >
                    {gearSaving ? "Adding…" : "Add to Vault"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ADD — Step 1: Custom gear form */}
          {gearDialog?.mode === "add" && gearStep === 1 && gearForm.is_custom && (
            <div className="space-y-3 mt-2">
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-relaxed">
                Custom gear will be added to your vault. AI will validate and may auto-approve it for the master catalogue.
              </div>
              <div>
                <label className={labelClass}>Gear Name *</label>
                <div className="relative">
                  <input
                    data-testid="gear-custom-name"
                    className={inputClass}
                    placeholder={`Custom ${gearForm.category} name…`}
                    value={gearForm.name}
                    onChange={e => handleGearNameChange(e.target.value)}
                    autoFocus
                  />
                  {aiNormLoading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Loader2 size={13} className="animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                {/* AI suggestion chip */}
                {aiNorm && !aiNormLoading && (
                  <div className="mt-1.5 flex items-start gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50">
                    <Sparkles size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-700 font-medium">
                        AI suggests: <span className="font-semibold">{aiNorm.normalized_name}</span>
                        {aiNorm.brand && <span className="font-normal text-blue-500"> · {aiNorm.brand}</span>}
                        {aiNorm.category && <span className="font-normal text-blue-500"> · {aiNorm.category}</span>}
                      </p>
                      {aiNorm.catalogue_match && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">✓ Already in catalogue — this will be a quick match!</p>
                      )}
                    </div>
                    <button
                      onClick={acceptAiSuggestion}
                      className="text-[10px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-md transition-colors flex-shrink-0"
                    >
                      Accept
                    </button>
                    <button onClick={() => setAiNorm(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Brand</label>
                  <input
                    data-testid="gear-brand"
                    className={inputClass}
                    placeholder="e.g. Sony"
                    value={gearForm.brand}
                    onChange={e => setGearForm(p => ({ ...p, brand: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Model</label>
                  <input
                    data-testid="gear-model"
                    className={inputClass}
                    placeholder="Model no."
                    value={gearForm.model_number}
                    onChange={e => setGearForm(p => ({ ...p, model_number: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setGearForm(p => ({ ...p, is_custom: false, name: "" }))}
                  className="flex-1 border-slate-200 text-slate-500 text-sm"
                >
                  Back to List
                </Button>
                <Button
                  data-testid="save-gear-btn"
                  onClick={handleGearSave}
                  disabled={gearSaving}
                  className="flex-1 font-display text-white text-sm"
                  style={{ background: "#F97316" }}
                >
                  {gearSaving ? "Saving…" : "Add Gear"}
                </Button>
              </div>
            </div>
          )}

          {/* EDIT MODE */}
          {gearDialog?.mode === "edit" && (
            <div className="space-y-3 mt-2">
              <div>
                <label className={labelClass}>Category *</label>
                <select data-testid="gear-category" className={inputClass} value={gearForm.category} onChange={e => setGearForm(p => ({ ...p, category: e.target.value }))}>
                  {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Gear Name *</label>
                <input
                  data-testid="gear-name-input"
                  className={inputClass}
                  placeholder="e.g. Sony A7 IV"
                  value={gearForm.name}
                  onChange={e => setGearForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Brand</label>
                  <input data-testid="gear-brand" className={inputClass} placeholder="Sony, Canon…" value={gearForm.brand} onChange={e => setGearForm(p => ({ ...p, brand: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Model</label>
                  <input data-testid="gear-model" className={inputClass} placeholder="A7 IV" value={gearForm.model_number} onChange={e => setGearForm(p => ({ ...p, model_number: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setGearDialog(null)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
                <Button
                  data-testid="save-gear-btn"
                  onClick={handleGearSave}
                  disabled={gearSaving}
                  className="flex-1 font-display text-white"
                  style={{ background: "#F97316" }}
                >
                  {gearSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Document Resubmit Dialog ─────────────────────────────────────── */}
      <Dialog open={docDialog} onOpenChange={() => setDocDialog(false)}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">
              {profile.verification_status === "rejected" ? "Resubmit Documents" : "Submit for Verification"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {profile.verification_status === "rejected" && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                Your previous submission was rejected. Please upload clearer documents and resubmit.
              </div>
            )}
            <div>
              <label className={labelClass}>ID Type</label>
              <select data-testid="doc-id-type" className={inputClass} value={docForm.id_type} onChange={e => setDocForm(p => ({ ...p, id_type: e.target.value }))}>
                <option>Aadhar</option>
                <option>PAN</option>
                <option>Driving License</option>
                <option>Passport</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Government ID (front) — max 2MB</label>
              <input data-testid="doc-govt-id" type="file" accept="image/*,application/pdf" className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
                onChange={e => handleFileChange("govt_id_base64", e)} />
              {docForm.govt_id_base64 && <p className="text-xs text-green-600 mt-1">Loaded</p>}
            </div>
            <div>
              <label className={labelClass}>Selfie with ID — max 2MB</label>
              <input data-testid="doc-selfie" type="file" accept="image/*" className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
                onChange={e => handleFileChange("selfie_base64", e)} />
              {docForm.selfie_base64 && <p className="text-xs text-green-600 mt-1">Loaded</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDocDialog(false)} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button
                data-testid="submit-doc-btn"
                onClick={handleDocSubmit}
                disabled={docSaving}
                className="flex-1 font-display text-white"
                style={{ background: "#3B82F6" }}
              >
                {docSaving ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// ── Role Selector (async, loads from platform API) ─────────────────────────────
function RoleSelect({ value, onChange, api, inputClass }) {
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    api.get("/platform/roles").then(r => setRoles(r.data.roles || [])).catch(() => {});
  }, [api]);
  return (
    <select data-testid="role-select" className={inputClass} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">No role selected</option>
      {roles.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}
