import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function Auth() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({ email: "", password: "", full_name: "", phone: "", location: "", pincode: "", referral_code: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginData.email, loginData.password);
      toast.success(`Welcome back, ${user.full_name}!`);
      navigate(user.is_admin ? "/admin" : user.onboarding_complete ? "/dashboard" : "/onboarding");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regData.email || !regData.password || !regData.full_name || !regData.phone) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await register(regData);
      toast.success("Account created! Let's set up your profile.");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 rounded-xl";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        {/* Back */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors" data-testid="auth-back-btn">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary">
            <span className="text-white font-bold font-display">C</span>
          </div>
          <span className="text-foreground text-xl font-semibold font-display">CrewBook</span>
        </div>

        <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6 bg-slate-100 border border-border">
              <TabsTrigger value="login" data-testid="auth-login-tab" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="auth-register-tab" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display">Register</TabsTrigger>
            </TabsList>

            {/* Login */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label className="text-slate-700 text-sm font-display">Email</Label>
                  <Input data-testid="login-email" className={`mt-1 ${inputClass}`} type="email" placeholder="you@example.com" value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-slate-700 text-sm font-display">Password</Label>
                  <div className="relative mt-1">
                    <Input data-testid="login-password" className={inputClass} type={showPass ? "text" : "password"} placeholder="••••••••" value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" data-testid="login-submit-btn" className="w-full font-semibold font-display mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Admin: admin@crewbook.in / Admin@123
                </p>
              </form>
            </TabsContent>

            {/* Register */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Full Name *</Label>
                    <Input data-testid="reg-name" className={`mt-1 ${inputClass}`} placeholder="Raj Sharma" value={regData.full_name} onChange={e => setRegData(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Phone *</Label>
                    <Input data-testid="reg-phone" className={`mt-1 ${inputClass}`} placeholder="9876543210" value={regData.phone} onChange={e => setRegData(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-display">Email *</Label>
                  <Input data-testid="reg-email" className={`mt-1 ${inputClass}`} type="email" placeholder="you@example.com" value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-display">Password *</Label>
                  <Input data-testid="reg-password" className={`mt-1 ${inputClass}`} type="password" placeholder="Min 6 characters" value={regData.password} onChange={e => setRegData(p => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">City *</Label>
                    <Input data-testid="reg-location" className={`mt-1 ${inputClass}`} placeholder="Mumbai" value={regData.location} onChange={e => setRegData(p => ({ ...p, location: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Pincode *</Label>
                    <Input data-testid="reg-pincode" className={`mt-1 ${inputClass}`} placeholder="400001" value={regData.pincode} onChange={e => setRegData(p => ({ ...p, pincode: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-display">Referral Code (optional)</Label>
                  <Input data-testid="reg-referral" className={`mt-1 ${inputClass}`} placeholder="e.g. RAJ12AB" value={regData.referral_code} onChange={e => setRegData(p => ({ ...p, referral_code: e.target.value }))} />
                </div>
                <Button type="submit" data-testid="register-submit-btn" className="w-full font-semibold font-display mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
