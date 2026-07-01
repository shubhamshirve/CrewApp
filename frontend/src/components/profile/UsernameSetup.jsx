import React from "react";
import { Link2, CheckCircle2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsernameSetup({ usernameInput, usernameStatus, usernameSaving, onInputChange, onSave }) {
  return (
    <div className="p-5 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={14} className="text-violet-500" />
        <h3 className="text-sm font-semibold text-slate-900 font-display">Claim your @username</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">One-time · cannot be changed</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Get a clean profile URL like <span className="font-mono text-violet-600">/u/johndoe</span> instead of a long ID.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">@</span>
          <input
            data-testid="username-input"
            className="w-full pl-6 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-violet-400 focus:outline-none font-mono"
            placeholder="yourname"
            value={usernameInput}
            maxLength={20}
            onChange={e => onInputChange(e.target.value)}
          />
          {usernameStatus === "checking" && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          {usernameStatus === "available" && <CheckCircle2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />}
          {usernameStatus === "taken" && <X size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400" />}
        </div>
        <Button
          size="sm"
          disabled={usernameStatus !== "available" || usernameSaving}
          onClick={onSave}
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
  );
}
