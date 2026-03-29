import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import InstallAppButton from '@/components/InstallAppButton';
import NotificationPermissionModal from '@/components/NotificationPermissionModal';

export default function Auth() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Pre-fill referral code from URL ?ref=CODE
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get("ref") || "";

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({
    email: "", password: "", full_name: "", phone: "",
    whatsapp_number: "", whatsapp_same_as_mobile: true,
    location: "", area: "", state: "", country: "India",
    pincode: "", referral_code: urlRef,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginData.email, loginData.password);

      // Check if notification modal was dismissed recently
      const dismissedUntil = localStorage.getItem('crewbook_notification_dismissed');
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);

      if (shouldShowModal) {
        // Show notification modal before redirecting
        setShowNotificationModal(true);
        // Store user data for redirect after modal closes
        sessionStorage.setItem('pendingUser', JSON.stringify({
          user,
          action: 'login'
        }));
      } else {
        // Skip modal, redirect immediately
        toast.success(`Welcome back, ${user.full_name}!`);
        navigate(user.is_admin ? '/admin/dashboard' : user.onboarding_complete ? '/dashboard' : '/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
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
      const payload = { ...regData };
      if (payload.whatsapp_same_as_mobile) payload.whatsapp_number = payload.phone;
      delete payload.whatsapp_same_as_mobile;
      await register(payload);

      // Check if notification modal was dismissed recently
      const dismissedUntil = localStorage.getItem('crewbook_notification_dismissed');
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);

      if (shouldShowModal) {
        // Show notification modal before redirecting
        setShowNotificationModal(true);
        // Store redirect action in session
        sessionStorage.setItem('pendingUser', JSON.stringify({
          action: 'register'
        }));
      } else {
        // Skip modal, redirect immediately
        toast.success('Account created! Let\'s set up your profile.');
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationModalComplete = () => {
    // Modal has completed (user accepted or dismissed)
    try {
      const pendingUser = sessionStorage.getItem('pendingUser');
      if (pendingUser) {
        const { user, action } = JSON.parse(pendingUser);
        sessionStorage.removeItem('pendingUser');

        if (action === 'login' && user) {
          toast.success(`Welcome back, ${user.full_name}!`);
          navigate(user.is_admin ? '/admin/dashboard' : user.onboarding_complete ? '/dashboard' : '/onboarding');
        } else if (action === 'register') {
          toast.success('Account created! Let\'s set up your profile.');
          navigate('/onboarding');
        }
      }
    } catch (err) {
      console.error('Failed to parse pending user:', err);
    }
    setShowNotificationModal(false);
  };

  const inputClass = "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#E05D26" }}>
            <span className="text-white font-bold font-display">C</span>
          </div>
          <span className="text-slate-900 text-xl font-semibold font-display">CrewBook</span>
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6 bg-slate-100 border border-slate-200">
              <TabsTrigger value="login" data-testid="auth-login-tab" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-display text-slate-500">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="auth-register-tab" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-display text-slate-500">Register</TabsTrigger>
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
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" data-testid="login-submit-btn" className="w-full font-semibold font-display mt-2 text-white" style={{ background: "#E05D26" }} disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* Register */}
            <TabsContent value="register">
              <div className="mb-4">
                <button onClick={() => navigate("/auth")} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors" data-testid="register-back-btn">
                  <ArrowLeft size={13} /> Back to login
                </button>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                {/* Row 1: Name + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Full Name *</Label>
                    <Input data-testid="reg-name" className={`mt-1 ${inputClass}`} placeholder="Raj Sharma" value={regData.full_name} onChange={e => setRegData(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Mobile *</Label>
                    <Input data-testid="reg-phone" className={`mt-1 ${inputClass}`} placeholder="9876543210" value={regData.phone} onChange={e => setRegData(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                {/* WhatsApp */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">WhatsApp Number</Label>
                  <Input
                    data-testid="reg-whatsapp"
                    className={`mt-1 ${inputClass} ${regData.whatsapp_same_as_mobile ? "opacity-50" : ""}`}
                    disabled={regData.whatsapp_same_as_mobile}
                    placeholder="Same as mobile"
                    value={regData.whatsapp_same_as_mobile ? regData.phone : regData.whatsapp_number}
                    onChange={e => setRegData(p => ({ ...p, whatsapp_number: e.target.value }))}
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input type="checkbox" checked={regData.whatsapp_same_as_mobile} onChange={e => setRegData(p => ({ ...p, whatsapp_same_as_mobile: e.target.checked }))} className="accent-orange-500" />
                    <span className="text-xs text-slate-500">Same as mobile</span>
                  </label>
                </div>
                {/* Email + Password */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Email *</Label>
                  <Input data-testid="reg-email" className={`mt-1 ${inputClass}`} type="email" placeholder="you@example.com" value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-display">Password *</Label>
                  <Input data-testid="reg-password" className={`mt-1 ${inputClass}`} type="password" placeholder="Min 6 characters" value={regData.password} onChange={e => setRegData(p => ({ ...p, password: e.target.value }))} />
                </div>
                {/* Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">City *</Label>
                    <Input data-testid="reg-location" className={`mt-1 ${inputClass}`} placeholder="Mumbai" value={regData.location} onChange={e => setRegData(p => ({ ...p, location: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Area</Label>
                    <Input data-testid="reg-area" className={`mt-1 ${inputClass}`} placeholder="Bandra West" value={regData.area} onChange={e => setRegData(p => ({ ...p, area: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">State</Label>
                    <Input data-testid="reg-state" className={`mt-1 ${inputClass}`} placeholder="Maharashtra" value={regData.state} onChange={e => setRegData(p => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Pincode *</Label>
                    <Input data-testid="reg-pincode" className={`mt-1 ${inputClass}`} placeholder="400001" value={regData.pincode} onChange={e => setRegData(p => ({ ...p, pincode: e.target.value }))} />
                  </div>
                </div>
                {/* Referral */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Referral Code {urlRef ? "(applied)" : "(optional)"}</Label>
                  <Input
                    data-testid="reg-referral"
                    className={`mt-1 ${inputClass} ${urlRef ? "opacity-60" : ""}`}
                    readOnly={!!urlRef}
                    placeholder="e.g. RAJ12AB"
                    value={regData.referral_code}
                    onChange={e => !urlRef && setRegData(p => ({ ...p, referral_code: e.target.value }))}
                  />
                  {urlRef && <p className="text-xs text-green-600 mt-1">Referral code applied automatically</p>}
                </div>
                <Button type="submit" data-testid="register-submit-btn" className="w-full font-semibold font-display mt-2 text-white" style={{ background: "#E05D26" }} disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <InstallAppButton />
        </div>
        <NotificationPermissionModal
          isOpen={showNotificationModal}
          onComplete={handleNotificationModalComplete}
        />
      </div>
    </div>
  );
}
