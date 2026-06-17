import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already logged in as admin
  if (user?.is_admin) {
    navigate("/admin/dashboard", { replace: true });
    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (!loggedInUser.is_admin) {
        toast.error("Access denied. Admin credentials required.");
        // logout is implicit — token was stored, clear it
        localStorage.removeItem("photoo_token");
        return;
      }
      toast.success("Welcome back, Admin");
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #080B12 0%, #0D1220 100%)" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}
          >
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display">Admin Panel</h1>
          <p className="text-zinc-500 text-sm mt-1">Photoo · Restricted Access</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-white/10 p-8"
          style={{ background: "rgba(13, 18, 32, 0.8)", backdropFilter: "blur(20px)" }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Admin Email</label>
              <input
                data-testid="admin-email-input"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{ background: "rgba(255,255,255,0.04)" }}
                placeholder="admin@photoo.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <input
                  data-testid="admin-password-input"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white border border-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              data-testid="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {loading ? "Authenticating…" : "Sign In to Admin Panel"}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-700 mt-6">
            This area is restricted to authorized administrators only.
          </p>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-4">
          Not an admin?{" "}
          <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            Go to Photoo
          </a>
        </p>
      </div>
    </div>
  );
}
