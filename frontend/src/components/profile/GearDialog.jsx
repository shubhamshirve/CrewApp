import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { CAT_COLORS, GEAR_CATEGORIES } from "./profileConstants";

const inputClass = "w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none transition-colors";
const labelClass = "text-xs font-display text-slate-600 mb-1 block";

export default function GearDialog({
  gearDialog, onClose,
  gearStep, setGearStep,
  gearForm, setGearForm,
  gearSaving, masterGear, onSave,
}) {
  const { api } = useAuth();
  const [aiNorm, setAiNorm] = useState(null);
  const [aiNormLoading, setAiNormLoading] = useState(false);
  const aiNormTimer = useRef(null);

  const fetchAiNorm = async (name) => {
    if (!name || name.trim().length < 3) { setAiNorm(null); setAiNormLoading(false); return; }
    setAiNormLoading(true);
    try {
      const res = await api.get(`/platform/gear-catalogue/normalize?name=${encodeURIComponent(name.trim())}`);
      const data = res.data;
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
      category: aiNorm.category && GEAR_CATEGORIES.includes(aiNorm.category) ? aiNorm.category : p.category,
    }));
    setAiNorm(null);
  };

  const handleClose = () => {
    setAiNorm(null);
    setAiNormLoading(false);
    if (aiNormTimer.current) clearTimeout(aiNormTimer.current);
    onClose();
  };

  return (
    <Dialog open={!!gearDialog} onOpenChange={handleClose}>
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
                <Button data-testid="save-gear-btn" onClick={onSave} disabled={gearSaving} className="w-full font-display text-white" style={{ background: "#F97316" }}>
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
                  <button onClick={acceptAiSuggestion}
                    className="text-[10px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-md transition-colors flex-shrink-0">
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
                <input data-testid="gear-brand" className={inputClass} placeholder="e.g. Sony" value={gearForm.brand}
                  onChange={e => setGearForm(p => ({ ...p, brand: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input data-testid="gear-model" className={inputClass} placeholder="Model no." value={gearForm.model_number}
                  onChange={e => setGearForm(p => ({ ...p, model_number: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setGearForm(p => ({ ...p, is_custom: false, name: "" }))}
                className="flex-1 border-slate-200 text-slate-500 text-sm">Back to List</Button>
              <Button data-testid="save-gear-btn" onClick={onSave} disabled={gearSaving} className="flex-1 font-display text-white text-sm" style={{ background: "#F97316" }}>
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
              <input data-testid="gear-name-input" className={inputClass} placeholder="e.g. Sony A7 IV" value={gearForm.name}
                onChange={e => setGearForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Brand</label>
                <input data-testid="gear-brand" className={inputClass} placeholder="Sony, Canon…" value={gearForm.brand}
                  onChange={e => setGearForm(p => ({ ...p, brand: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input data-testid="gear-model" className={inputClass} placeholder="A7 IV" value={gearForm.model_number}
                  onChange={e => setGearForm(p => ({ ...p, model_number: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={handleClose} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
              <Button data-testid="save-gear-btn" onClick={onSave} disabled={gearSaving} className="flex-1 font-display text-white" style={{ background: "#F97316" }}>
                {gearSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
