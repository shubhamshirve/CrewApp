import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const inputClass = "w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none transition-colors";
const labelClass = "text-xs font-display text-slate-600 mb-1 block";

export default function DocUploadDialog({ open, onClose, verificationStatus, onSuccess }) {
  const { api } = useAuth();
  const [docForm, setDocForm] = useState({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
  const [docSaving, setDocSaving] = useState(false);

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

  const handleSubmit = async () => {
    if (!docForm.govt_id_base64 || !docForm.selfie_base64) {
      toast.error("Please upload both documents"); return;
    }
    setDocSaving(true);
    try {
      await api.post("/users/id-upload", docForm);
      onSuccess();
      onClose();
      setDocForm({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
      toast.success("Documents submitted! Admin will review within 24 hours.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit documents");
    } finally {
      setDocSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-slate-900 font-display">
            {verificationStatus === "rejected" ? "Resubmit Documents" : "Submit for Verification"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {verificationStatus === "rejected" && (
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
            <input data-testid="doc-govt-id" type="file" accept="image/*,application/pdf"
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
              onChange={e => handleFileChange("govt_id_base64", e)} />
            {docForm.govt_id_base64 && <p className="text-xs text-green-600 mt-1">Loaded</p>}
          </div>
          <div>
            <label className={labelClass}>Selfie with ID — max 2MB</label>
            <input data-testid="doc-selfie" type="file" accept="image/*"
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
              onChange={e => handleFileChange("selfie_base64", e)} />
            {docForm.selfie_base64 && <p className="text-xs text-green-600 mt-1">Loaded</p>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 border-slate-200 text-slate-500">Cancel</Button>
            <Button data-testid="submit-doc-btn" onClick={handleSubmit} disabled={docSaving} className="flex-1 font-display text-white" style={{ background: "#3B82F6" }}>
              {docSaving ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
