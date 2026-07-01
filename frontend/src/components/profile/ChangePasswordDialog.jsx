import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePasswordDialog({ open, onClose }) {
  const { api } = useAuth();
  const [form, setForm] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    onClose();
    setForm({ current: "", newPass: "", confirm: "" });
  };

  const handleSubmit = async () => {
    if (!form.current) { toast.error("Enter your current password"); return; }
    if (form.newPass.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (form.newPass !== form.confirm) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current, new_password: form.newPass });
      toast.success("Password changed successfully");
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
              value={form.current}
              onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-display">New Password</label>
            <input
              data-testid="change-pass-new"
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
              placeholder="Min 8 chars, letter + number"
              value={form.newPass}
              onChange={e => setForm(p => ({ ...p, newPass: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-display">Confirm New Password</label>
            <input
              data-testid="change-pass-confirm"
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
              placeholder="Re-enter new password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-slate-200 text-slate-500" onClick={handleClose}>Cancel</Button>
            <Button
              data-testid="change-pass-submit"
              className="flex-1 text-white font-display"
              style={{ background: "#F97316" }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving…" : "Update Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
