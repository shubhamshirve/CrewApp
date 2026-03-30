/**
 * PlanGate — wraps a page and shows an inline upgrade wall
 * when the user has no active plan. Admin always bypasses.
 *
 * Allowed pages without plan: /profile/:id, /search, /wallet
 * (handled at route level in App.js — this component is only
 *  rendered for gated pages).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Lock, ArrowRight } from "lucide-react";

export default function PlanGate({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasPlan =
    user?.is_admin === true ||
    (user?.subscription_plan && user?.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date());

  if (hasPlan) return children;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center">
      {/* Lock icon */}
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-5">
        <Lock size={28} className="text-orange-400" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 font-display mb-2">
        Subscription Required
      </h2>
      <p className="text-slate-500 text-sm max-w-xs mb-6">
        This feature is available to subscribed members only. Choose a plan to
        unlock the full CrewBook experience.
      </p>

      <button
        onClick={() => navigate("/wallet")}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#F97316" }}
      >
        <Crown size={16} />
        View Plans & Subscribe
        <ArrowRight size={14} />
      </button>

      <p className="text-xs text-slate-400 mt-4">
        Already subscribed?{" "}
        <button
          className="text-orange-500 underline"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </p>
    </div>
  );
}
