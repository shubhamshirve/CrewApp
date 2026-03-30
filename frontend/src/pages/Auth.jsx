import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2, MapPin } from "lucide-react";
import InstallAppButton from "@/components/InstallAppButton";
import NotificationPermissionModal from "@/components/NotificationPermissionModal";
import { fetchPincodeData } from "@/utils/pincode";
import {
  validateEmail, validateIndianPhone, validatePassword,
  validatePincode, validateName, sanitizeText, sanitizeEmail,
} from "@/utils/validation";

const FieldError = ({ msg }) =>
  msg ? <p className="text-xs text-red-500 mt-0.5">{msg}</p> : null;

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export default function Auth() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

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

  // ── Forgot Password state ──────────────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState("idle"); // "idle"|"send"|"otp"|"done"
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDevOtp, setForgotDevOtp] = useState("");
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const forgotTimerRef = useRef(null);

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState("form"); // "form" | "otp" | "verified"
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState(""); // shown when no Resend key
  const [emailVerifiedToken, setEmailVerifiedToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  // ── Pincode state ──────────────────────────────────────────────────────────
  const [pincodeStatus, setPincodeStatus] = useState("idle"); // "idle"|"loading"|"valid"|"invalid"

  // ── Inline field errors ────────────────────────────────────────────────────
  const [loginErrors, setLoginErrors] = useState({});
  const [regErrors, setRegErrors] = useState({});

  const setLoginErr = (field, msg) => setLoginErrors(p => ({ ...p, [field]: msg }));
  const clearLoginErr = (field) => setLoginErrors(p => ({ ...p, [field]: "" }));
  const setRegErr = (field, msg) => setRegErrors(p => ({ ...p, [field]: msg }));
  const clearRegErr = (field) => setRegErrors(p => ({ ...p, [field]: "" }));

  // ── Countdown timer for resend ─────────────────────────────────────────────
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(countdownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [countdown]);

  useEffect(() => {
    if (forgotCountdown > 0) {
      forgotTimerRef.current = setInterval(() => {
        setForgotCountdown(c => {
          if (c <= 1) { clearInterval(forgotTimerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(forgotTimerRef.current);
  }, [forgotCountdown]);

  // ── Pincode auto-fill ──────────────────────────────────────────────────────
  const handlePincodeBlur = async (pincode) => {
    if (!pincode || pincode.length !== 6) { setPincodeStatus("idle"); return; }
    setPincodeStatus("loading");
    const result = await fetchPincodeData(pincode);
    if (!result) { setPincodeStatus("idle"); return; }
    if (result.valid) {
      setRegData(p => ({
        ...p,
        state: result.state || p.state,
        location: result.city || p.location,
        area: p.area || result.area,    // don't overwrite if user already typed an area
      }));
      setPincodeStatus("valid");
      toast.success(`Pincode found: ${result.city}, ${result.state}`);
    } else {
      setPincodeStatus("invalid");
      toast.error("Invalid pincode — please check and try again");
    }
  };

  // ── Send OTP ───────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!regData.email) { toast.error("Please enter your email address first"); return; }
    if (!regData.full_name) { toast.error("Please enter your full name first"); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regData.email, full_name: regData.full_name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code");
      setOtpStep("otp");
      setCountdown(60);
      if (data.otp_dev) {
        setOtpDevCode(data.otp_dev);
        toast.info(`Dev mode — OTP: ${data.otp_dev}`, { duration: 30000 });
      } else {
        toast.success(`Verification code sent to ${regData.email}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regData.email, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code");
      setEmailVerifiedToken(data.email_verified_token);
      setOtpStep("verified");
      toast.success("Email verified!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Forgot Password handlers ───────────────────────────────────────────────
  const handleSendResetOtp = async () => {
    if (!forgotEmail) { toast.error("Enter your email address"); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code");
      setForgotStep("otp");
      setForgotCountdown(60);
      if (data.otp_dev) {
        setForgotDevOtp(data.otp_dev);
        toast.info(`Dev mode — OTP: ${data.otp_dev}`, { duration: 30000 });
      } else {
        toast.success("Reset code sent to your email");
      }
    } catch (err) { toast.error(err.message); }
    finally { setForgotLoading(false); }
  };

  const handleResetPassword = async () => {
    if (forgotOtp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    if (!forgotNewPass || forgotNewPass.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, new_password: forgotNewPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setForgotStep("done");
      toast.success("Password reset! You can now sign in.");
    } catch (err) { toast.error(err.message); }
    finally { setForgotLoading(false); }
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(loginData.email);
    const passErr = !loginData.password ? "Password is required" : "";
    setLoginErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;
    setLoading(true);
    try {
      const user = await login(sanitizeEmail(loginData.email), loginData.password);
      const dismissedUntil = localStorage.getItem("crewbook_notification_dismissed");
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);
      if (shouldShowModal) {
        setShowNotificationModal(true);
        sessionStorage.setItem("pendingUser", JSON.stringify({ user, action: "login" }));
      } else {
        toast.success(`Welcome back, ${user.full_name}!`);
        navigate(user.is_admin ? "/admin/dashboard" : user.onboarding_complete ? "/dashboard" : "/onboarding");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    const errors = {
      full_name: validateName(regData.full_name, "Full name"),
      phone: validateIndianPhone(regData.phone),
      email: validateEmail(regData.email),
      password: validatePassword(regData.password),
      pincode: validatePincode(regData.pincode),
      location: !regData.location.trim() ? "City is required" : "",
    };
    setRegErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      toast.error("Please fix the errors before continuing");
      return;
    }
    if (!emailVerifiedToken) {
      toast.error("Please verify your email first");
      return;
    }
    if (pincodeStatus === "invalid") {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...regData,
        full_name: sanitizeText(regData.full_name),
        email: sanitizeEmail(regData.email),
        location: sanitizeText(regData.location),
        email_verified_token: emailVerifiedToken,
      };
      if (payload.whatsapp_same_as_mobile) payload.whatsapp_number = payload.phone;
      delete payload.whatsapp_same_as_mobile;
      await register(payload);

      const dismissedUntil = localStorage.getItem("crewbook_notification_dismissed");
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);
      if (shouldShowModal) {
        setShowNotificationModal(true);
        sessionStorage.setItem("pendingUser", JSON.stringify({ action: "register" }));
      } else {
        toast.success("Account created! Let's set up your profile.");
        navigate("/onboarding");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationModalComplete = () => {
    try {
      const pendingUser = sessionStorage.getItem("pendingUser");
      if (pendingUser) {
        const { user, action } = JSON.parse(pendingUser);
        sessionStorage.removeItem("pendingUser");
        if (action === "login" && user) {
          toast.success(`Welcome back, ${user.full_name}!`);
          navigate(user.is_admin ? "/admin/dashboard" : user.onboarding_complete ? "/dashboard" : "/onboarding");
        } else if (action === "register") {
          toast.success("Account created! Let's set up your profile.");
          navigate("/onboarding");
        }
      }
    } catch {}
    setShowNotificationModal(false);
  };

  const ic = "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20";

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

            {/* ── Login ── */}
            <TabsContent value="login">
              {forgotStep === "idle" || forgotStep === "done" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label className="text-slate-700 text-sm font-display">Email</Label>
                    <Input data-testid="login-email" className={`mt-1 ${ic} ${loginErrors.email ? "border-red-400" : ""}`} type="email" placeholder="you@example.com" value={loginData.email}
                      onChange={e => { setLoginData(p => ({ ...p, email: e.target.value })); clearLoginErr("email"); }}
                      onBlur={e => setLoginErr("email", validateEmail(e.target.value))}
                    />
                    <FieldError msg={loginErrors.email} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-sm font-display">Password</Label>
                    <div className="relative mt-1">
                      <Input data-testid="login-password" className={`${ic} ${loginErrors.password ? "border-red-400" : ""}`} type={showPass ? "text" : "password"} placeholder="••••••••" value={loginData.password}
                        onChange={e => { setLoginData(p => ({ ...p, password: e.target.value })); clearLoginErr("password"); }}
                        onBlur={e => setLoginErr("password", !e.target.value ? "Password is required" : "")}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <FieldError msg={loginErrors.password} />
                  </div>
                  <button
                    type="button"
                    data-testid="forgot-password-link"
                    onClick={() => { setForgotStep("send"); setForgotEmail(loginData.email); }}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                  >
                    Forgot password?
                  </button>
                  <Button type="submit" data-testid="login-submit-btn" className="w-full font-semibold font-display mt-2 text-white" style={{ background: "#E05D26" }} disabled={loading}>
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                </form>
              ) : (
                /* ── Forgot Password inline section ── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setForgotStep("idle")} className="text-slate-400 hover:text-slate-600">
                      <ArrowLeft size={15} />
                    </button>
                    <h3 className="text-sm font-semibold text-slate-800 font-display">Reset Password</h3>
                  </div>

                  {forgotStep === "send" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-slate-700 text-sm font-display">Email address</Label>
                        <Input
                          data-testid="forgot-email"
                          className={`mt-1 ${ic}`}
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        data-testid="send-reset-otp-btn"
                        className="w-full font-semibold text-white"
                        style={{ background: "#E05D26" }}
                        onClick={handleSendResetOtp}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Send Reset Code"}
                      </Button>
                    </div>
                  )}

                  {forgotStep === "otp" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                        <p className="text-xs text-slate-600 mb-2">
                          Enter the 6-digit code sent to <strong>{forgotEmail}</strong>
                          {forgotDevOtp && <span className="ml-1 text-orange-600 font-semibold">(Dev: {forgotDevOtp})</span>}
                        </p>
                        <div className="flex gap-2">
                          <Input
                            data-testid="reset-otp-input"
                            className={`${ic} tracking-widest text-center font-mono font-bold text-lg`}
                            placeholder="000000"
                            maxLength={6}
                            value={forgotOtp}
                            onChange={e => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="shrink-0 text-white text-xs px-3"
                            style={{ background: "#E05D26" }}
                            onClick={handleSendResetOtp}
                            disabled={forgotLoading || forgotCountdown > 0}
                          >
                            {forgotCountdown > 0 ? `${forgotCountdown}s` : "Resend"}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-700 text-sm font-display">New Password</Label>
                        <Input
                          data-testid="reset-new-password"
                          className={`mt-1 ${ic}`}
                          type="password"
                          placeholder="Min 8 chars, letter + number"
                          value={forgotNewPass}
                          onChange={e => setForgotNewPass(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                        />
                      </div>
                      <Button
                        type="button"
                        data-testid="reset-password-btn"
                        className="w-full font-semibold text-white"
                        style={{ background: "#16a34a" }}
                        onClick={handleResetPassword}
                        disabled={forgotLoading || forgotOtp.length !== 6}
                      >
                        {forgotLoading ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Reset Password"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Register ── */}
            <TabsContent value="register">
              <div className="mb-4">
                <button onClick={() => navigate("/auth")} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors" data-testid="register-back-btn">
                  <ArrowLeft size={13} /> Back to login
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                {/* Name + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Full Name *</Label>
                    <Input data-testid="reg-name" className={`mt-1 ${ic} ${regErrors.full_name ? "border-red-400" : ""}`} placeholder="Raj Sharma" value={regData.full_name}
                      onChange={e => { setRegData(p => ({ ...p, full_name: e.target.value })); clearRegErr("full_name"); }}
                      onBlur={e => setRegErr("full_name", validateName(e.target.value, "Full name"))}
                    />
                    <FieldError msg={regErrors.full_name} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Mobile *</Label>
                    <Input data-testid="reg-phone" className={`mt-1 ${ic} ${regErrors.phone ? "border-red-400" : ""}`} placeholder="9876543210" value={regData.phone}
                      onChange={e => { setRegData(p => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })); clearRegErr("phone"); }}
                      onBlur={e => setRegErr("phone", validateIndianPhone(e.target.value))}
                    />
                    <FieldError msg={regErrors.phone} />
                  </div>
                </div>

                {/* WhatsApp */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">WhatsApp Number</Label>
                  <Input
                    data-testid="reg-whatsapp"
                    className={`mt-1 ${ic} ${regData.whatsapp_same_as_mobile ? "opacity-50" : ""}`}
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

                {/* Email + OTP verification block */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Email *</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        data-testid="reg-email"
                        className={`${ic} ${otpStep === "verified" ? "border-green-400 pr-8" : ""}`}
                        type="email"
                        placeholder="you@example.com"
                        value={regData.email}
                        disabled={otpStep !== "form"}
                        onChange={e => { setRegData(p => ({ ...p, email: e.target.value })); setOtpStep("form"); setEmailVerifiedToken(""); }}
                      />
                      {otpStep === "verified" && (
                        <CheckCircle2 size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" />
                      )}
                    </div>
                    {otpStep === "form" && (
                      <Button
                        type="button"
                        data-testid="send-otp-btn"
                        size="sm"
                        className="shrink-0 text-white font-semibold text-xs px-3"
                        style={{ background: "#E05D26" }}
                        onClick={handleSendOtp}
                        disabled={otpLoading || !regData.email}
                      >
                        {otpLoading ? <Loader2 size={14} className="animate-spin" /> : "Send Code"}
                      </Button>
                    )}
                    {otpStep === "otp" && (
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0 text-white font-semibold text-xs px-3"
                        style={{ background: "#E05D26" }}
                        onClick={handleSendOtp}
                        disabled={otpLoading || countdown > 0}
                      >
                        {countdown > 0 ? `${countdown}s` : "Resend"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* OTP input (shown after code is sent) */}
                {otpStep === "otp" && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs text-slate-600 mb-2 font-display">
                      Enter the 6-digit code sent to <strong>{regData.email}</strong>
                      {otpDevCode && <span className="ml-1 text-orange-600 font-semibold">(Dev: {otpDevCode})</span>}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        data-testid="otp-input"
                        className={`${ic} tracking-widest text-center font-mono font-bold text-lg`}
                        placeholder="000000"
                        maxLength={6}
                        value={otpValue}
                        onChange={e => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                      />
                      <Button
                        type="button"
                        data-testid="verify-otp-btn"
                        className="shrink-0 text-white font-semibold text-xs px-4"
                        style={{ background: "#E05D26" }}
                        onClick={handleVerifyOtp}
                        disabled={otpLoading || otpValue.length !== 6}
                      >
                        {otpLoading ? <Loader2 size={14} className="animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Password *</Label>
                  <Input data-testid="reg-password" className={`mt-1 ${ic} ${regErrors.password ? "border-red-400" : ""}`} type="password" placeholder="Min 8 chars, letter + number" value={regData.password}
                    onChange={e => { setRegData(p => ({ ...p, password: e.target.value })); clearRegErr("password"); }}
                    onBlur={e => setRegErr("password", validatePassword(e.target.value))}
                  />
                  <FieldError msg={regErrors.password} />
                </div>

                {/* Pincode → auto-fill City + State */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Pincode *</Label>
                  <div className="relative mt-1">
                    <Input
                      data-testid="reg-pincode"
                      className={`${ic} ${pincodeStatus === "valid" ? "border-green-400 pr-8" : pincodeStatus === "invalid" ? "border-red-400" : ""}`}
                      placeholder="400001"
                      maxLength={6}
                      value={regData.pincode}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setRegData(p => ({ ...p, pincode: v }));
                        setPincodeStatus("idle");
                      }}
                      onBlur={e => handlePincodeBlur(e.target.value)}
                    />
                    {pincodeStatus === "loading" && (
                      <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                    {pincodeStatus === "valid" && (
                      <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" />
                    )}
                    {pincodeStatus === "invalid" && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500 text-xs">✗</span>
                    )}
                  </div>
                  {pincodeStatus === "invalid" && (
                    <p className="text-xs text-red-500 mt-0.5">Invalid pincode — please check</p>
                  )}
                </div>

                {/* City + Area (auto-filled from pincode) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-700 text-xs font-display flex items-center gap-1">
                      City *
                      {pincodeStatus === "valid" && <MapPin size={10} className="text-green-500" />}
                    </Label>
                    <Input data-testid="reg-location" className={`mt-1 ${ic} ${regErrors.location ? "border-red-400" : ""}`} placeholder="Mumbai" value={regData.location}
                      onChange={e => { setRegData(p => ({ ...p, location: e.target.value })); clearRegErr("location"); }}
                      onBlur={e => setRegErr("location", !e.target.value.trim() ? "City is required" : "")}
                    />
                    <FieldError msg={regErrors.location} />
                  </div>
                  <div>
                    <Label className="text-slate-700 text-xs font-display">Area</Label>
                    <Input data-testid="reg-area" className={`mt-1 ${ic}`} placeholder="Bandra West" value={regData.area} onChange={e => setRegData(p => ({ ...p, area: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-display flex items-center gap-1">
                    State
                    {pincodeStatus === "valid" && <MapPin size={10} className="text-green-500" />}
                  </Label>
                  <Input data-testid="reg-state" className={`mt-1 ${ic}`} placeholder="Maharashtra" value={regData.state} onChange={e => setRegData(p => ({ ...p, state: e.target.value }))} />
                </div>

                {/* Referral */}
                <div>
                  <Label className="text-slate-700 text-xs font-display">Referral Code {urlRef ? "(applied)" : "(optional)"}</Label>
                  <Input
                    data-testid="reg-referral"
                    className={`mt-1 ${ic} ${urlRef ? "opacity-60" : ""}`}
                    readOnly={!!urlRef}
                    placeholder="e.g. RAJ12AB"
                    value={regData.referral_code}
                    onChange={e => !urlRef && setRegData(p => ({ ...p, referral_code: e.target.value }))}
                  />
                  {urlRef && <p className="text-xs text-green-600 mt-1">Referral code applied automatically</p>}
                </div>

                <Button
                  type="submit"
                  data-testid="register-submit-btn"
                  className="w-full font-semibold font-display mt-2 text-white"
                  style={{ background: otpStep === "verified" ? "#16a34a" : "#E05D26" }}
                  disabled={loading || otpStep !== "verified"}
                >
                  {loading ? "Creating account…" : otpStep === "verified" ? "Create Account" : "Verify email to continue"}
                </Button>

                {otpStep !== "verified" && (
                  <p className="text-xs text-center text-slate-400">You must verify your email before creating an account</p>
                )}
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
