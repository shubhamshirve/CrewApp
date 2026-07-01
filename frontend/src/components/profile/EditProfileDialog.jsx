import React, { useState, useEffect, useRef } from "react";
import { Instagram, Globe, Link2, ChevronDown, Loader2, CheckCircle2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPincodeData } from "@/utils/pincode";
import { INDIAN_CITIES, INDIAN_STATES } from "./profileConstants";

const inputClass = "w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none transition-colors";
const labelClass = "text-xs font-display text-slate-600 mb-1 block";

function CitySelect({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = INDIAN_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
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

function RoleSelect({ value, onChange }) {
  const { api } = useAuth();
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

export default function EditProfileDialog({ open, onClose, profile, onSaved, onChangePassword }) {
  const { api, refreshUser } = useAuth();
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState("idle");

  useEffect(() => {
    if (open && profile) {
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
      setPincodeStatus("idle");
    }
  }, [open, profile]);

  const handlePincodeBlur = async (pincode) => {
    if (!pincode || String(pincode).length !== 6) { setPincodeStatus("idle"); return; }
    setPincodeStatus("loading");
    const result = await fetchPincodeData(pincode);
    if (!result) { setPincodeStatus("idle"); return; }
    if (result.valid) {
      setEditForm(p => ({ ...p, state: result.state || p.state, location: result.city || p.location }));
      setPincodeStatus("valid");
      toast.success(`Pincode found: ${result.city}, ${result.state}`);
    } else {
      setPincodeStatus("invalid");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.whatsapp_same_as_mobile) payload.whatsapp_number = payload.phone;
      Object.keys(payload).forEach(k => { if (payload[k] === "") delete payload[k]; });
      if (payload.primary_rate) payload.primary_rate = parseFloat(payload.primary_rate);
      if (payload.secondary_rate) payload.secondary_rate = parseFloat(payload.secondary_rate);
      if (payload.years_of_experience) payload.years_of_experience = parseInt(payload.years_of_experience);
      const res = await api.put("/users/profile", payload);
      onSaved(res.data);
      await refreshUser();
      onClose();
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
                <CitySelect value={editForm.location || ""} onChange={v => setEditForm(p => ({ ...p, location: v }))} />
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
                    onBlur={e => handlePincodeBlur(e.target.value)}
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
                <RoleSelect value={editForm.primary_role || ""} onChange={v => setEditForm(p => ({ ...p, primary_role: v }))} />
              </div>
              <div>
                <label className={labelClass}>Primary Day Rate (₹)</label>
                <input data-testid="edit-primary-rate" type="number" className={inputClass} placeholder="15000" value={editForm.primary_rate || ""} onChange={e => setEditForm(p => ({ ...p, primary_rate: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Secondary Role (optional)</label>
                <RoleSelect value={editForm.secondary_role || ""} onChange={v => setEditForm(p => ({ ...p, secondary_role: v }))} />
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
            <Button variant="outline" onClick={onClose} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
            <Button
              data-testid="save-profile-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 font-display text-white"
              style={{ background: "#F97316" }}
            >
              {saving ? "Saving…" : <><Save size={14} className="mr-1.5" />Save Changes</>}
            </Button>
          </div>

          <button
            type="button"
            data-testid="open-change-password-btn"
            onClick={() => { onClose(); onChangePassword(); }}
            className="w-full text-xs text-orange-500 hover:text-orange-600 font-medium mt-1 text-center"
          >
            Change Password
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
