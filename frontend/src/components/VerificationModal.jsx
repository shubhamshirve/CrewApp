import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const labelClass = "text-xs font-display text-slate-600 mb-1 block";
const inputClass = "w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-900 focus:border-orange-400 outline-none transition-colors";

const toB64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

/**
 * VerificationModal — shared document submission flow.
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onSuccess     () => void          called after successful submit
 *   api           axios instance
 *   verificationStatus  string        user's current verification_status
 */
export default function VerificationModal({ open, onClose, onSuccess, api, verificationStatus }) {
  const [docForm, setDocForm] = useState({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
  const [saving, setSaving] = useState(false);

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
      toast.error("Please upload both documents");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users/id-upload", docForm);
      toast.success("Documents submitted! Admin will review within 24 hours.");
      setDocForm({ id_type: "Aadhar", govt_id_base64: "", selfie_base64: "" });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit documents");
    } finally {
      setSaving(false);
    }
  };

  const isRejected = verificationStatus === "rejected";
  const isPending = verificationStatus === "pending";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-slate-900 font-display flex items-center gap-2">
            <Shield size={16} className="text-blue-500" />
            {isRejected ? "Resubmit Documents" : "Submit for Verification"}
          </DialogTitle>
        </DialogHeader>

        {isPending ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-amber-400" />
            <p className="text-sm font-medium text-slate-800 font-display">Verification Under Review</p>
            <p className="text-xs text-slate-500">Your documents are being reviewed by our team. You'll be notified once approved.</p>
            <Button variant="outline" onClick={onClose} className="border-slate-200 text-slate-500 w-full mt-2">Close</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {isRejected && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                Your previous submission was rejected. Please upload clearer documents and resubmit.
              </div>
            )}

            <div>
              <label className={labelClass}>ID Type</label>
              <select
                data-testid="doc-id-type"
                className={inputClass}
                value={docForm.id_type}
                onChange={e => setDocForm(p => ({ ...p, id_type: e.target.value }))}
              >
                <option>Aadhar</option>
                <option>PAN</option>
                <option>Driving License</option>
                <option>Passport</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Government ID (front) — max 2MB</label>
              <input
                data-testid="doc-govt-id"
                type="file"
                accept="image/*,application/pdf"
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
                onChange={e => handleFileChange("govt_id_base64", e)}
              />
              {docForm.govt_id_base64 && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Loaded</p>}
            </div>

            <div>
              <label className={labelClass}>Selfie with ID — max 2MB</label>
              <input
                data-testid="doc-selfie"
                type="file"
                accept="image/*"
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer"
                onChange={e => handleFileChange("selfie_base64", e)}
              />
              {docForm.selfie_base64 && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Loaded</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1 border-slate-200 text-slate-500">
                Cancel
              </Button>
              <Button
                data-testid="submit-verification-btn"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 font-display text-white gap-1.5"
                style={{ background: "#3B82F6" }}
              >
                <Upload size={13} />
                {saving ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
