import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Wallet as WalletIcon, Check, Crown, MessageSquare,
  Gift, CreditCard, Copy, Share2, Users, Globe, Loader2,
  RefreshCw, ArrowUpCircle, ArrowDownCircle, Calendar, AlertCircle, Tag,
} from "lucide-react";
import { toast } from "sonner";

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Wallet() {
  const { user, api, refreshUser } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [referralStats, setReferralStats] = useState(null);
  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponResult, setCouponResult] = useState(null);   // { code, discount_type, discount_value, discount_amount, original_price, final_price }
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedPlanForCoupon, setSelectedPlanForCoupon] = useState(null);

  const loadWallet = useCallback(async () => {
    try {
      const [walletRes, statsRes] = await Promise.all([
        api.get("/wallet"),
        api.get("/wallet/referral-stats"),
      ]);
      setWalletData(walletRes.data);
      setReferralStats(statsRes.data);
    } catch { } finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    loadWallet();
    api.get("/plans").then(r => {
      setPlans(r.data.plans || []);
    }).catch(() => {}).finally(() => setPlansLoading(false));
  }, [loadWallet, api]);

  const handleValidateCoupon = async (planId) => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const r = await api.post("/coupons/validate", { code: couponInput.trim(), plan_id: planId || null });
      setCouponResult(r.data);
      setSelectedPlanForCoupon(planId);
      toast.success(`Coupon applied! You save ${r.data.discount_type === "percentage" ? r.data.discount_value + "%" : "₹" + r.data.discount_value}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invalid coupon");
      setCouponResult(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput("");
    setCouponResult(null);
    setSelectedPlanForCoupon(null);
  };

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.getElementById("rzp-script")) { resolve(true); return; }
      const script = document.createElement("script");
      script.id = "rzp-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleSubscribe = async (plan) => {
    setSubscribing(plan.id);
    const appliedCoupon = (couponResult && selectedPlanForCoupon === plan.id) ? couponResult.code : null;
    try {
      const res = await api.post("/wallet/subscribe/create-order", {
        plan_id: plan.id,
        coupon_code: appliedCoupon,
      });
      if (res.data.full_wallet_cover) {
        await api.post("/wallet/subscribe/activate-wallet", {
          plan_id: plan.id,
          coupon_code: appliedCoupon,
        });
        toast.success("Subscription activated using your wallet balance!");
        await refreshUser();
        await loadWallet();
        handleRemoveCoupon();
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load payment gateway"); return; }
      const { order, key_id, wallet_deducted, coupon_code, discount_amount } = res.data;
      const options = {
        key: key_id,
        amount: order.amount,
        currency: "INR",
        name: "CrewBook",
        description: `${plan.name} ₹${plan.price}/month`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await api.post("/wallet/subscribe/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: plan.id,
              wallet_deducted: wallet_deducted || 0,
              coupon_code: coupon_code || null,
              discount_amount: discount_amount || 0,
            });
            toast.success("Subscription activated!");
            await refreshUser();
            await loadWallet();
            handleRemoveCoupon();
          } catch { toast.error("Payment verification failed"); }
        },
        prefill: { name: user?.full_name, contact: user?.phone },
        theme: { color: "#F59E0B" },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Subscription failed");
    } finally {
      setSubscribing(null);
    }
  };

  const currentPlan = user?.subscription_plan || "free";
  const activePlanId = user?.active_plan_id;
  const activePlanFeatures = user?.active_plan_features || {};
  const activePlanName = walletData?.active_plan_name || user?.active_plan_name;
  const expiresAt = walletData?.subscription_expires_at;
  const daysLeft = daysUntil(expiresAt);
  const canRenew = daysLeft !== null && daysLeft <= 3 && currentPlan !== "free";
  const pendingPlanName = walletData?.pending_plan_name;
  const pendingPlanAt = walletData?.pending_plan_change_at;

  // Upgrade: new plan has higher price than current
  // Downgrade: new plan has lower price
  const handleUpgrade = async (plan) => {
    setSubscribing(plan.id + "_upgrade");
    try {
      const res = await api.post("/wallet/subscribe/upgrade", { plan_id: plan.id });
      if (res.data.full_wallet_cover) {
        toast.success(`Upgraded to ${plan.name}! Pro-rata ₹${res.data.pro_rata_credited} credited to wallet.`);
        await refreshUser(); await loadWallet(); return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load payment gateway"); return; }
      const { order, key_id, wallet_deducted, pro_rata_credited } = res.data;
      const options = {
        key: key_id, amount: order.amount, currency: "INR",
        name: "CrewBook", description: `Upgrade to ${plan.name}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await api.post("/wallet/subscribe/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: plan.id, wallet_deducted: wallet_deducted || 0,
            });
            toast.success(`Upgraded to ${plan.name}!${pro_rata_credited > 0 ? ` ₹${pro_rata_credited} refunded to wallet.` : ""}`);
            await refreshUser(); await loadWallet();
          } catch { toast.error("Payment verification failed"); }
        },
        prefill: { name: user?.full_name, contact: user?.phone },
        theme: { color: "#F59E0B" },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upgrade failed");
    } finally { setSubscribing(null); }
  };

  const handleDowngrade = async (plan) => {
    setSubscribing(plan.id + "_downgrade");
    try {
      const res = await api.post("/wallet/subscribe/downgrade", { plan_id: plan.id });
      toast.success(res.data.message);
      await loadWallet();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Downgrade scheduling failed");
    } finally { setSubscribing(null); }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 font-display">Subscription</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your plan, wallet balance, and referrals</p>
        </div>

        {/* Wallet Balance Card */}
        <div className="p-6 rounded-2xl border border-orange-200 relative overflow-hidden bg-white shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #E05D26, transparent)" }} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-display uppercase tracking-wide">Wallet Balance</p>
              <p data-testid="wallet-balance" className="text-4xl font-bold text-slate-900 font-display mt-1 font-mono">
                ₹{walletData?.balance?.toFixed(2) || "0.00"}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-display">Auto-applied on next renewal</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-50">
              <WalletIcon size={24} style={{ color: "#E05D26" }} />
            </div>
          </div>
        </div>

        {/* Referral Card */}
        <div
          data-testid="referral-section"
          className="p-6 rounded-2xl border relative overflow-hidden bg-white shadow-sm"
          style={{ borderColor: "#FED7AA" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #F97316, transparent)" }} />
          <div className="flex items-center gap-2 mb-4">
            <Gift size={16} className="text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-900 font-display">Refer & Earn</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-display">
              ₹{referralStats?.reward_per_referral || 50} per referral
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users size={13} className="text-slate-400" />
                <span className="text-xs text-slate-500 font-display">Referred</span>
              </div>
              <p data-testid="referred-count" className="text-xl font-bold text-slate-900 font-display">
                {referralStats?.referred_count ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <WalletIcon size={13} className="text-orange-400" />
                <span className="text-xs text-orange-600 font-display">Earned</span>
              </div>
              <p data-testid="referral-earned" className="text-xl font-bold text-orange-600 font-display font-mono">
                ₹{(referralStats?.total_earned || 0).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Code row */}
          <div className="mb-3">
            <p className="text-xs text-slate-500 font-display mb-1.5">Your referral code</p>
            <div className="flex items-center gap-2">
              <code
                data-testid="referral-code"
                className="flex-1 px-3 py-2 rounded-lg border border-dashed border-orange-300 bg-orange-50 text-orange-600 font-mono font-bold text-base tracking-widest text-center select-all"
              >
                {referralStats?.referral_code || walletData?.referral_code || user?.referral_code || ""}
              </code>
              <button
                data-testid="copy-referral-code-btn"
                onClick={() => { navigator.clipboard.writeText(referralStats?.referral_code || walletData?.referral_code || user?.referral_code || ""); toast.success("Referral code copied!"); }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs font-display transition-all flex items-center gap-1"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>

          {/* Link row */}
          <div>
            <p className="text-xs text-slate-500 font-display mb-1.5">Shareable referral link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                data-testid="referral-link"
                value={`${window.location.origin}/auth?ref=${referralStats?.referral_code || walletData?.referral_code || user?.referral_code || ""}`}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono outline-none cursor-text select-all truncate"
                onClick={e => e.target.select()}
              />
              <button
                data-testid="copy-referral-link-btn"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/auth?ref=${referralStats?.referral_code || walletData?.referral_code || ""}`); toast.success("Referral link copied!"); }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs font-display transition-all flex items-center gap-1 whitespace-nowrap"
              >
                <Copy size={12} /> Copy Link
              </button>
              <button
                data-testid="share-referral-btn"
                onClick={async () => {
                  const link = `${window.location.origin}/auth?ref=${referralStats?.referral_code || walletData?.referral_code || ""}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: "Join CrewBook", text: `Use my referral code to join CrewBook!`, url: link }); }
                    catch {}
                  } else { navigator.clipboard.writeText(link); toast.success("Referral link copied!"); }
                }}
                className="px-3 py-2 rounded-lg text-white text-xs font-display transition-all flex items-center gap-1 whitespace-nowrap"
                style={{ background: "#F97316" }}
              >
                <Share2 size={12} /> Share
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              When someone registers using your link, the referral code is pre-filled automatically.
              You earn ₹{referralStats?.reward_per_referral || 50} when they subscribe.
            </p>
          </div>
        </div>

        {/* Current Plan */}
        {currentPlan !== "free" && (
          <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Crown size={18} className="text-orange-500 flex-shrink-0" />
                <div>
                  <p data-testid="active-plan-name" className="text-sm font-semibold text-slate-900 font-display">
                    {activePlanName || currentPlan}
                  </p>
                  {expiresAt && (
                    <p data-testid="plan-expiry" className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      Expires {new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {daysLeft !== null && daysLeft >= 0 && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-display ${daysLeft <= 3 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                          {daysLeft === 0 ? "expires today" : `${daysLeft}d left`}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {activePlanFeatures.whatsapp_enabled && (
                  <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5 font-display bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <MessageSquare size={11} /> WhatsApp
                  </span>
                )}
                {activePlanFeatures.public_gig_enabled && (
                  <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5 font-display bg-blue-50 text-blue-600 border border-blue-200">
                    <Globe size={11} /> Gig Board
                  </span>
                )}
                {canRenew && activePlanId && (
                  <button
                    data-testid="renew-plan-btn"
                    onClick={() => handleSubscribe(plans.find(p => p.id === activePlanId) || {})}
                    className="text-xs px-3 py-1.5 rounded-lg font-display text-white flex items-center gap-1.5"
                    style={{ background: "#F97316" }}
                  >
                    <RefreshCw size={11} /> Renew Now
                  </button>
                )}
              </div>
            </div>
            {/* Pending downgrade notice */}
            {pendingPlanName && pendingPlanAt && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span>Plan will change to <strong>{pendingPlanName}</strong> on {new Date(pendingPlanAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
          </div>
        )}

        {/* Plans */}
        {plansLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-orange-400" />
          </div>
        ) : plans.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <CreditCard size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-display">No subscription plans available yet</p>
            <p className="text-xs text-slate-400 mt-1">Check back soon — plans will be published by the admin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Coupon Input */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 mb-2 font-display uppercase tracking-wide">Have a Coupon Code?</p>
              {couponResult ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-700 font-mono">{couponResult.code}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {couponResult.discount_type === "percentage"
                        ? `${couponResult.discount_value}% off`
                        : `₹${couponResult.discount_value} off`}
                      {couponResult.discount_amount ? ` — saves ₹${couponResult.discount_amount.toFixed(0)}` : ""}
                    </p>
                  </div>
                  <button onClick={handleRemoveCoupon} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal focus:border-orange-400 outline-none"
                    placeholder="Enter code (e.g. SAVE20)"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") handleValidateCoupon(selectedPlanForCoupon); }}
                  />
                  <button
                    onClick={() => handleValidateCoupon(null)}
                    disabled={couponLoading || !couponInput.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "#F97316" }}
                  >
                    {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map(plan => {
              const isActive = activePlanId === plan.id;
              const currentPlanObj = plans.find(p => p.id === activePlanId);
              const isUpgrade = !isActive && currentPlanObj && plan.price > currentPlanObj.price;
              const isDowngrade = !isActive && currentPlanObj && plan.price < currentPlanObj.price;
              const hasActivePlan = currentPlan !== "free" && activePlanId;
              return (
                <div key={plan.id} data-testid={`plan-card-${plan.id}`} className="p-6 rounded-2xl border relative overflow-hidden bg-white shadow-sm border-slate-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500 font-display">{plan.name}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold text-slate-900 font-display">₹{plan.price}</span>
                        <span className="text-slate-400 text-xs">/{plan.validity === "yearly" ? "year" : "month"}</span>
                      </div>
                      {plan.description && <p className="text-xs text-slate-400 mt-1">{plan.description}</p>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-display capitalize border border-slate-200">
                      {plan.validity || "monthly"}
                    </span>
                  </div>

                  {/* Feature indicators */}
                  <div className="space-y-2 mb-5">
                    <div className={`flex items-center gap-2 text-xs ${plan.features?.public_gig_enabled ? "text-blue-600" : "text-slate-400"}`}>
                      {plan.features?.public_gig_enabled ? <Check size={12} className="text-blue-500" /> : <span className="w-3 h-3 rounded-full border border-slate-300 inline-block" />}
                      <Globe size={12} />
                      Public Gig Board Access
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${plan.features?.whatsapp_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                      {plan.features?.whatsapp_enabled ? <Check size={12} className="text-emerald-500" /> : <span className="w-3 h-3 rounded-full border border-slate-300 inline-block" />}
                      <MessageSquare size={12} />
                      WhatsApp Notifications
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Check size={12} className="text-emerald-500" />
                      Unlimited bookings & networking
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Check size={12} className="text-emerald-500" />
                      In-app & email alerts
                    </div>
                  </div>

                  {isActive ? (
                    <div className="w-full text-center py-2 text-xs rounded-lg font-display text-emerald-600 border border-emerald-200 bg-emerald-50">
                      Current Plan
                    </div>
                  ) : isUpgrade ? (
                    <Button
                      data-testid={`upgrade-plan-btn-${plan.id}`}
                      onClick={() => handleUpgrade(plan)}
                      disabled={!!subscribing}
                      className="w-full font-display font-semibold gap-2 text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <ArrowUpCircle size={14} />
                      {subscribing === plan.id + "_upgrade" ? "Processing..." : "Upgrade — Pro-rata refund"}
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      data-testid={`downgrade-plan-btn-${plan.id}`}
                      onClick={() => handleDowngrade(plan)}
                      disabled={!!subscribing || pendingPlanName === plan.name}
                      variant="outline"
                      className="w-full font-display font-semibold gap-2 border-slate-300"
                    >
                      <ArrowDownCircle size={14} />
                      {pendingPlanName === plan.name ? "Downgrade Scheduled" :
                        subscribing === plan.id + "_downgrade" ? "Scheduling..." : "Downgrade at Renewal"}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {/* Coupon discount preview on this card */}
                      {couponResult && (couponResult.applicable_plan_id === plan.id || !couponResult.applicable_plan_id) && (
                        <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center justify-between">
                          <span>Coupon: <strong>{couponResult.code}</strong></span>
                          <span className="font-bold">
                            {couponResult.final_price !== null ? `₹${couponResult.final_price.toFixed(0)}` : `-${couponResult.discount_value}${couponResult.discount_type === "percentage" ? "%" : "₹"}`}
                          </span>
                        </div>
                      )}
                      <Button
                        data-testid={`subscribe-plan-btn-${plan.id}`}
                        onClick={() => handleSubscribe(plan)}
                        disabled={!!subscribing}
                        className="w-full font-display font-semibold gap-2 text-white"
                        style={{ background: "#E05D26" }}
                      >
                        <CreditCard size={14} />
                        {subscribing === plan.id ? "Processing..." : "Subscribe"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Transaction History */}
        {walletData?.transactions?.length > 0 && (
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Transaction History</h3>
            <div className="space-y-2">
              {walletData.transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0" data-testid={`transaction-${tx.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 font-display truncate">{tx.description}</p>
                    <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono flex-shrink-0 ${tx.type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
                    {tx.type === "credit" ? "+" : "-"}₹{tx.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Billing info */}
        <div className="p-3 rounded-lg border border-orange-100 text-xs text-slate-500 bg-orange-50">
          <span className="text-orange-600 font-display">Smart Billing:</span> Your wallet balance is automatically deducted first during renewals. You only pay the remaining amount via UPI/card.
        </div>
      </div>
    </Layout>
  );
}
