import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, ChevronRight, Plus, X, Upload } from "lucide-react";

const STYLES = ["Cinematic","Candid","Traditional","Documentary","Fine Art","Dark & Moody","Bright & Airy"];
const EDITING = ["Lightroom","Photoshop","Final Cut Pro","Premiere Pro","DaVinci Resolve","Capture One"];
const GEAR_CATS = ["Camera","Lens","Lighting","Drone","Audio","Other"];
const ID_TYPES = ["Aadhar","PAN","Driving License","Passport"];

const STEPS = ["Your Role & Rates", "Style & Gear", "Verify Identity", "Complete"];

const DEFAULT_ROLES = ["Lead Photographer","Second Shooter","Traditional Videographer","Cinematic Videographer","Drone Operator","Photo Assistant","Video Assistant","Lighting Technician","Photo Editor","Video Editor"];

export default function Onboarding() {
  const { user, api, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rolesList, setRolesList] = useState(DEFAULT_ROLES);

  useEffect(() => {
    api.get("/platform/roles").then(r => {
      if (r.data?.roles?.length) setRolesList(r.data.roles);
    }).catch(() => {});
  }, []);

  const [profileData, setProfileData] = useState({
    primary_role: user?.primary_role || "",
    secondary_role: user?.secondary_role || "",
    primary_rate: user?.primary_rate || "",
    secondary_rate: user?.secondary_rate || "",
    bio: user?.bio || "",
    style_tags: user?.style_tags || [],
    editing_ecosystem: user?.editing_ecosystem || [],
  });

  const [gear, setGear] = useState({ name: "", category: "Camera", brand: "" });
  const [gearList, setGearList] = useState(user?.gear_vault || []);

  const [idData, setIdData] = useState({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });

  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 rounded-xl";

  const toggleTag = (arr, val, field) => {
    const cur = profileData[field];
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
    setProfileData(p => ({ ...p, [field]: next }));
  };

  const handleFileToBase64 = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setIdData(p => ({ ...p, [field]: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const saveStep0 = async () => {
    if (!profileData.primary_role) { toast.error("Please select a primary role"); return; }
    setLoading(true);
    try {
      await api.put("/users/profile", {
        primary_role: profileData.primary_role,
        secondary_role: profileData.secondary_role || null,
        primary_rate: parseFloat(profileData.primary_rate) || 0,
        secondary_rate: parseFloat(profileData.secondary_rate) || 0,
        bio: profileData.bio,
      });
      setStep(1);
    } catch { toast.error("Failed to save"); } finally { setLoading(false); }
  };

  const saveStep1 = async () => {
    setLoading(true);
    try {
      await api.put("/users/profile", { style_tags: profileData.style_tags, editing_ecosystem: profileData.editing_ecosystem });
      if (gearList.length !== (user?.gear_vault?.length || 0)) {
        // Save each new gear item
        for (const g of gearList) {
          if (!user?.gear_vault?.find(x => x.id === g.id)) {
            await api.post("/users/gear", { name: g.name, category: g.category, brand: g.brand });
          }
        }
      }
      setStep(2);
    } catch { toast.error("Failed to save"); } finally { setLoading(false); }
  };

  const saveStep2 = async () => {
    if (!idData.govt_id_base64 || !idData.selfie_base64) { toast.error("Please upload both ID and selfie"); return; }
    setLoading(true);
    try {
      await api.post("/users/id-upload", idData);
      await api.put("/users/onboarding/complete");
      await refreshUser();
      setStep(3);
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary">
            <span className="text-white font-bold text-sm font-display">C</span>
          </div>
          <span className="text-foreground font-semibold font-display text-lg">CrewBook</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                {i < 3 && <span className="text-xs text-muted-foreground hidden sm:block font-display">{s}</span>}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground font-display mb-4">Your Role & Day Rates</h2>
              <div>
                <Label className="text-slate-700 text-sm font-display">Primary Role *</Label>
                <select data-testid="primary-role-select" value={profileData.primary_role} onChange={e => setProfileData(p => ({ ...p, primary_role: e.target.value }))} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}>
                  <option value="">Select role...</option>
                  {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display">Primary Day Rate (₹)</Label>
                <Input data-testid="primary-rate-input" className={`mt-1 ${inputClass}`} type="number" placeholder="e.g. 8000" value={profileData.primary_rate} onChange={e => setProfileData(p => ({ ...p, primary_rate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display">Secondary Role (optional)</Label>
                <select data-testid="secondary-role-select" value={profileData.secondary_role} onChange={e => setProfileData(p => ({ ...p, secondary_role: e.target.value }))} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}>
                  <option value="">None</option>
                  {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display">Bio (optional)</Label>
                <textarea data-testid="bio-input" value={profileData.bio} onChange={e => setProfileData(p => ({ ...p, bio: e.target.value }))} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border resize-none h-20`} placeholder="Tell leads about yourself..." />
              </div>
              <Button data-testid="step-0-next" onClick={saveStep0} className="w-full font-semibold font-display bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" disabled={loading}>
                {loading ? "Saving..." : "Continue"} <ChevronRight size={16} />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-foreground font-display mb-4">Style & Gear</h2>
              <div>
                <Label className="text-slate-700 text-sm font-display mb-2 block">Shooting Style</Label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map(s => (
                    <button key={s} data-testid={`style-tag-${s}`} onClick={() => toggleTag(profileData.style_tags, s, "style_tags")} className={`px-3 py-1.5 rounded-full text-xs border transition-all font-display ${profileData.style_tags.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border text-slate-600 hover:border-primary/40"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display mb-2 block">Editing Software</Label>
                <div className="flex flex-wrap gap-2">
                  {EDITING.map(e => (
                    <button key={e} data-testid={`editing-tag-${e}`} onClick={() => toggleTag(profileData.editing_ecosystem, e, "editing_ecosystem")} className={`px-3 py-1.5 rounded-full text-xs border transition-all font-display ${profileData.editing_ecosystem.includes(e) ? "border-primary bg-primary/10 text-primary" : "border-border text-slate-600 hover:border-primary/40"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display mb-2 block">Gear Vault</Label>
                <div className="flex gap-2 mb-2">
                  <Input data-testid="gear-name-input" className={`flex-1 ${inputClass} text-xs`} placeholder="Gear name (e.g. Sony A7IV)" value={gear.name} onChange={e => setGear(p => ({ ...p, name: e.target.value }))} />
                  <select data-testid="gear-category-select" value={gear.category} onChange={e => setGear(p => ({ ...p, category: e.target.value }))} className={`px-2 py-1.5 rounded-lg text-xs ${inputClass} border`}>
                    {GEAR_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button data-testid="add-gear-btn" onClick={() => { if (gear.name) { setGearList(p => [...p, { ...gear, id: Date.now().toString() }]); setGear({ name: "", category: "Camera", brand: "" }); }}} className="p-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gearList.map(g => (
                    <span key={g.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-slate-50 text-slate-600 text-xs">
                      {g.name} <button onClick={() => setGearList(p => p.filter(x => x.id !== g.id))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)} className="border-border text-slate-600 hover:text-foreground rounded-full">Back</Button>
                <Button data-testid="step-1-next" onClick={saveStep1} className="flex-1 font-semibold font-display bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" disabled={loading}>
                  {loading ? "Saving..." : "Continue"} <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground font-display mb-2">Verify Your Identity</h2>
              <p className="text-sm text-muted-foreground mb-4">Upload your government ID and a selfie. Our admin team will review within 24 hours.</p>
              <div>
                <Label className="text-slate-700 text-sm font-display">ID Type</Label>
                <select data-testid="id-type-select" value={idData.id_type} onChange={e => setIdData(p => ({ ...p, id_type: e.target.value }))} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}>
                  {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display">Government ID Photo *</Label>
                <label data-testid="govt-id-upload" className="mt-1 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:border-primary/50 transition-colors bg-slate-50 border-border">
                  {idData.govt_id_base64 ? <span className="text-primary text-sm flex items-center gap-2"><Check size={16} /> ID Uploaded</span> : <><Upload size={20} className="text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Upload Aadhar/PAN/DL</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileToBase64(e, "govt_id_base64")} />
                </label>
              </div>
              <div>
                <Label className="text-slate-700 text-sm font-display">Live Selfie *</Label>
                <label data-testid="selfie-upload" className="mt-1 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:border-primary/50 transition-colors bg-slate-50 border-border">
                  {idData.selfie_base64 ? <span className="text-primary text-sm flex items-center gap-2"><Check size={16} /> Selfie Uploaded</span> : <><Upload size={20} className="text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Take a selfie now</span></>}
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => handleFileToBase64(e, "selfie_base64")} />
                </label>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="border-border text-slate-600 hover:text-foreground rounded-full">Back</Button>
                <Button data-testid="submit-id-btn" onClick={saveStep2} className="flex-1 font-semibold font-display bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" disabled={loading}>
                  {loading ? "Uploading..." : "Submit for Verification"}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-primary/10">
                <Check size={32} className="text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground font-display">Profile Complete!</h2>
              <p className="text-muted-foreground text-sm">Your ID is being reviewed. You'll be notified once verified.</p>
              <p className="text-muted-foreground text-xs">In the meantime, explore the platform and set up your availability.</p>
              <Button data-testid="go-to-dashboard-btn" onClick={() => navigate("/dashboard")} className="font-semibold font-display w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
