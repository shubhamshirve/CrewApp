import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";

// Full-screen gate shown when the logged-in user's account has
// must_change_password = true (e.g. an admin generated a temporary
// password for them). Blocks the rest of the app until a new
// password is set.
export default function ForcePasswordChange() {
  const { api, refreshUser, logout } = useAuth();
  const [form, setForm] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.current) { toast.error("Enter the temporary password you were given"); return; }
    if (form.newPass.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (!/[A-Za-z]/.test(form.newPass) || !/\d/.test(form.newPass)) { toast.error("New password must contain a letter and a number"); return; }
    if (form.newPass !== form.confirm) { toast.error("Passwords don't match"); return; }

    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current, new_password: form.newPass });
      toast.success("Password updated! Welcome back.");
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50 mb-3">
            <KeyRound size={22} className="text-orange-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 font-display">Password Reset Required</h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            An admin has reset your password. Enter the temporary password you were given, then choose a new one to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 font-display">Temporary Password</label>
            <input
              data-testid="force-pw-current"
              type="password"
              autoFocus
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
              placeholder="Enter temporary password"
              value={form.current}
              onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-display">New Password</label>
            <input
              data-testid="force-pw-new"
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
              data-testid="force-pw-confirm"
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-orange-400"
              placeholder="Re-enter new password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
            />
          </div>
          <button
            data-testid="force-pw-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 font-display"
            style={{ background: "#F97316" }}
          >
            {loading ? "Updating…" : "Set New Password & Continue"}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <LogOut size={12} /> Log out instead
        </button>
      </div>
    </div>
  );
}
