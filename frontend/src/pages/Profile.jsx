import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Shield, MapPin, Star, Camera, User, UserPlus, UserCheck,
  StickyNote, Save, Trash2, Pencil, Plus, X, Upload,
  Instagram, Globe, Wallet, Link2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

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
  const { id } = useParams();
  const { user, api, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState({ avg_rating: null, total_ratings: 0, ratings: [] });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Notes
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteExists, setNoteExists] = useState(false);

  // Gear
  const [gearDialog, setGearDialog] = useState(null); // null | { mode:'add'|'edit', item? }
  const [gearForm, setGearForm] = useState({ name: "", category: "Camera", brand: "", model_number: "" });
  const [gearSaving, setGearSaving] = useState(false);
  const [masterGear, setMasterGear] = useState([]);

  // Doc resubmit
  const [docDialog, setDocDialog] = useState(false);
  const [docForm, setDocForm] = useState({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
  const [docSaving, setDocSaving] = useState(false);

  const isOwn = user?.id === id;

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, ratingsRes] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/ratings/user/${id}`),
        ]);
        setProfile(userRes.data);
        if (!isOwn) {
          const conns = await api.get("/connections");
          const found = conns.data.find(c => c.user?.id === id);
          setConnectionStatus(found ? "connected" : null);
          setNoteLoading(true);
          const noteRes = await api.get(`/notes/${id}`);
          setNote(noteRes.data.content || "");
          setNoteExists(noteRes.data.exists || false);
          setNoteLoading(false);
        }
        setRatings(ratingsRes.data);
        // Load master gear catalogue
        try {
          const metaRes = await api.get("/platform/gear-catalogue");
          setMasterGear(metaRes.data?.items || []);
        } catch { /* fallback to manual entry */ }
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
      // Remove empty strings to avoid overwriting with empty
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
    setGearForm({ name: "", category: "Camera", brand: "", model_number: "" });
    setGearDialog({ mode: "add" });
  };

  const openGearEdit = (item) => {
    setGearForm({ name: item.name, category: item.category, brand: item.brand || "", model_number: item.model_number || "" });
    setGearDialog({ mode: "edit", item });
  };

  const handleGearSave = async () => {
    if (!gearForm.name.trim()) { toast.error("Gear name required"); return; }
    setGearSaving(true);
    try {
      if (gearDialog.mode === "add") {
        const res = await api.post("/users/gear", gearForm);
        setProfile(p => ({ ...p, gear_vault: [...(p.gear_vault || []), res.data] }));
        toast.success("Gear added");
      } else {
        await api.put(`/users/gear/${gearDialog.item.id}`, gearForm);
        setProfile(p => ({
          ...p,
          gear_vault: p.gear_vault.map(g => g.id === gearDialog.item.id ? { ...g, ...gearForm } : g),
        }));
        toast.success("Gear updated");
      }
      setGearDialog(null);
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
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-100 border-2 border-slate-200">
              {profile.profile_image
                ? <img src={profile.profile_image} alt={profile.full_name} className="w-full h-full object-cover" />
                : <User size={32} className="text-slate-400" />
              }
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
                {isOwn && profile.upi_id && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Wallet size={12} /> UPI: {profile.upi_id}
                  </span>
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
                {/* Verification status */}
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
              connectionStatus === "connected" ? (
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-500" disabled data-testid="connected-badge">
                  <UserCheck size={14} className="mr-1.5 text-emerald-500" /> Connected
                </Button>
              ) : connectionStatus === "pending" ? (
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-400" disabled data-testid="pending-connection-badge">
                  Request Sent
                </Button>
              ) : (
                <Button size="sm" data-testid="connect-btn" onClick={handleConnect} style={{ background: "#F97316", color: "#fff" }} className="font-display font-semibold">
                  <UserPlus size={14} className="mr-1.5" /> Connect
                </Button>
              )
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

        {/* Private Lead Notes */}
        {!isOwn && (
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </section>

            {/* Location */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Location</p>
              <div className="grid grid-cols-2 gap-3">
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
                  <input data-testid="edit-pincode" className={inputClass} placeholder="400001" value={editForm.pincode || ""} onChange={e => setEditForm(p => ({ ...p, pincode: e.target.value }))} />
                </div>
              </div>
            </section>

            {/* Roles & Rates */}
            <section>
              <p className="text-xs font-display text-slate-400 uppercase tracking-wide mb-3">Roles & Rates (max 2)</p>
              <div className="grid grid-cols-2 gap-3">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Gear Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!gearDialog} onOpenChange={() => setGearDialog(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-display">
              {gearDialog?.mode === "add" ? "Add Gear" : "Edit Gear"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className={labelClass}>Gear Name *</label>
              {masterGear.length > 0 ? (
                <select data-testid="gear-name-select" className={inputClass} value={gearForm.name} onChange={e => {
                  const sel = masterGear.find(g => g.name === e.target.value);
                  setGearForm(p => ({ ...p, name: e.target.value, category: sel?.category || p.category, brand: sel?.brand || p.brand }));
                }}>
                  <option value="">Select from catalogue…</option>
                  {masterGear.map(g => <option key={g.id || g.name} value={g.name}>{g.name} ({g.category})</option>)}
                  <option value="__custom__">Other (custom entry)</option>
                </select>
              ) : null}
              {(gearForm.name === "__custom__" || masterGear.length === 0) && (
                <input data-testid="gear-name-input" className={`${inputClass} mt-2`} placeholder="e.g. Sony A7 IV" value={gearForm.name === "__custom__" ? "" : gearForm.name} onChange={e => setGearForm(p => ({ ...p, name: e.target.value }))} />
              )}
            </div>
            <div>
              <label className={labelClass}>Category *</label>
              <select data-testid="gear-category" className={inputClass} value={gearForm.category} onChange={e => setGearForm(p => ({ ...p, category: e.target.value }))}>
                {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                {gearSaving ? "Saving…" : gearDialog?.mode === "add" ? "Add Gear" : "Save Changes"}
              </Button>
            </div>
          </div>
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
