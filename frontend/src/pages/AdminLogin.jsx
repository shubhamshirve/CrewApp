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
        localStorage.removeItem("crewbook_token");
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-center font-display">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">CrewBook · Restricted Access</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 w-full max-w-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs text-slate-700 mb-1.5 block font-medium">Admin Email</label>
              <input
                data-testid="admin-email-input"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="admin@crewbook.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <input
                  data-testid="admin-password-input"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              data-testid="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {loading ? "Authenticating…" : "Sign In to Admin Panel"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-700 mt-6">
            This area is restricted to authorized administrators only.
          </p>
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">
          Not an admin?{" "}
          <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            Go to CrewBook
          </a>
        </p>
      </div>
    </div>
  );
}
