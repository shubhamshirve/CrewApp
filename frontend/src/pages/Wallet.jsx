import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Wallet as WalletIcon, Check, Crown, MessageSquare,
  Gift, CreditCard, Copy, Share2, Users,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PLANS = [
  {
    id: "base",
    name: "Base Plan",
    price: 69,
    features: ["Verified professional badge", "Unlimited bookings", "In-app & email alerts", "Digital wallet & referrals", "Calendar sync"],
    color: "#9CA3AF",
  },
  {
    id: "premium",
    name: "Premium Plan",
    price: 99,
    features: ["Everything in Base", "WhatsApp actionable alerts", "Accept/Reject from WhatsApp", "Sunday schedule dispatch"],
    color: "#F59E0B",
    popular: true,
  },
];

export default function Wallet() {
  const { user, api, refreshUser } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [referralStats, setReferralStats] = useState(null);

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
    // Fetch dynamic pricing from admin settings
    api.get("/platform/settings").then(r => {
      if (r.data) {
        setPlans([
          {
            id: "base",
            name: r.data.base_plan_name || "Base Plan",
            price: r.data.base_plan_price || 69,
            features: ["Verified professional badge", "Unlimited bookings", "In-app & email alerts", "Digital wallet & referrals", "Calendar sync"],
            color: "#9CA3AF",
          },
          {
            id: "premium",
            name: r.data.premium_plan_name || "Premium Plan",
            price: r.data.premium_plan_price || 99,
            features: ["Everything in Base", "WhatsApp actionable alerts", "Accept/Reject from WhatsApp", "Sunday schedule dispatch"],
            color: "#F59E0B",
            popular: true,
          },
        ]);
      }
    }).catch(() => {});
  }, [loadWallet, api]);

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

  const handleSubscribe = async (planId) => {
    setSubscribing(planId);
    try {
      const res = await api.post("/wallet/subscribe/create-order", { plan: planId });
      if (res.data.full_wallet_cover) {
        await api.post("/wallet/subscribe/activate-wallet", { plan: planId });
        toast.success("Subscription activated using your wallet balance!");
        await refreshUser();
        await loadWallet();
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load payment gateway"); return; }
      const { order, key_id, wallet_deducted } = res.data;
      const options = {
        key: key_id,
        amount: order.amount,
        currency: "INR",
        name: "CrewBook",
        description: `${plans.find(p => p.id === planId)?.name || planId} ₹${plans.find(p => p.id === planId)?.price || ""}/month`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await api.post("/wallet/subscribe/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
              wallet_deducted: wallet_deducted || 0,
            });
            toast.success("Subscription activated!");
            await refreshUser();
            await loadWallet();
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

  const referralCode = referralStats?.referral_code || walletData?.referral_code || user?.referral_code || "";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join CrewBook",
          text: `Use my referral code ${referralCode} to join CrewBook — India's crew booking platform for photo & video professionals!`,
          url: referralLink,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const currentPlan = user?.subscription_plan || "free";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 font-display">Wallet & Subscription</h1>
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
                {referralCode}
              </code>
              <button
                data-testid="copy-referral-code-btn"
                onClick={copyCode}
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
                value={referralLink}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono outline-none cursor-text select-all truncate"
                onClick={e => e.target.select()}
              />
              <button
                data-testid="copy-referral-link-btn"
                onClick={copyLink}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs font-display transition-all flex items-center gap-1 whitespace-nowrap"
              >
                <Copy size={12} /> Copy Link
              </button>
              <button
                data-testid="share-referral-btn"
                onClick={shareLink}
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
          <div className="p-4 rounded-xl border border-orange-200 flex items-center justify-between gap-3 bg-orange-50">
            <div className="flex items-center gap-3">
              <Crown size={18} className="text-orange-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900 font-display">{currentPlan === "premium" ? "Premium Plan" : "Base Plan"} Active</p>
                {walletData?.subscription_expires_at && (
                  <p className="text-xs text-slate-500">Renews: {new Date(walletData.subscription_expires_at).toLocaleDateString("en-IN")}</p>
                )}
              </div>
            </div>
            {currentPlan === "premium" && walletData?.whatsapp_enabled && (
              <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5 font-display bg-emerald-50 text-emerald-600 border border-emerald-200">
                <MessageSquare size={11} /> WhatsApp ON
              </span>
            )}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map(plan => {
            const isActive = currentPlan === plan.id;
            const isUpgrade = currentPlan === "free" || (currentPlan === "base" && plan.id === "premium");
            return (
              <div key={plan.id} data-testid={`plan-card-${plan.id}`} className="p-6 rounded-2xl border relative overflow-hidden bg-white shadow-sm" style={{ borderColor: plan.popular ? "#E05D26" : "#E2E8F0" }}>
                {plan.popular && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #E05D26, transparent)" }} />}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 font-display">{plan.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold text-slate-900 font-display">₹{plan.price}</span>
                      <span className="text-slate-400 text-xs">/month</span>
                    </div>
                  </div>
                  {plan.popular && <span className="text-xs px-2 py-0.5 rounded-full font-display bg-orange-50 text-orange-600 border border-orange-200">Popular</span>}
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="w-full text-center py-2 text-xs rounded-lg font-display text-emerald-600 border border-emerald-200 bg-emerald-50">
                    Current Plan
                  </div>
                ) : (
                  <Button
                    data-testid={`subscribe-${plan.id}-btn`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing === plan.id}
                    className="w-full font-display font-semibold gap-2 text-white"
                    style={plan.popular ? { background: "#E05D26" } : { background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0" }}
                  >
                    <CreditCard size={14} />
                    {subscribing === plan.id ? "Processing..." : isUpgrade ? "Upgrade" : "Subscribe"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Transaction History */}
        {walletData?.transactions?.length > 0 && (
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 font-display mb-4">Transaction History</h3>
            <div className="space-y-2">
              {walletData.transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0" data-testid={`transaction-${tx.id}`}>
                  <div>
                    <p className="text-xs text-slate-700 font-display">{tx.description}</p>
                    <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${tx.type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
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
