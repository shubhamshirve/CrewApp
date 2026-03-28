import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon, Check, Crown, MessageSquare, Gift, CreditCard } from "lucide-react";
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
  }, []);

  const loadWallet = async () => {
    try {
      const res = await api.get("/wallet");
      setWalletData(res.data);
    } catch { } finally { setLoading(false); }
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

  const handleSubscribe = async (planId) => {
    setSubscribing(planId);
    try {
      const res = await api.post("/wallet/subscribe/create-order", { plan: planId });
      if (res.data.full_wallet_cover) {
        // Full wallet cover
        await api.post("/wallet/subscribe/activate-wallet", { plan: planId });
        toast.success("Subscription activated using your wallet balance!");
        await refreshUser();
        await loadWallet();
        return;
      }

      // Need Razorpay
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

  const currentPlan = user?.subscription_plan || "free";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground font-display">Wallet & Subscription</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your plan, wallet balance, and referrals</p>
        </div>

        {/* Wallet Balance Card */}
        <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">Wallet Balance</p>
              <p data-testid="wallet-balance" className="text-4xl font-bold text-foreground font-display mt-1 font-mono">₹{walletData?.balance?.toFixed(2) || "0.00"}</p>
              <p className="text-xs text-muted-foreground mt-1 font-display">Auto-applied on next renewal</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10">
              <WalletIcon size={24} className="text-primary" />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border flex items-center gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground font-display">Referral Code</p>
              <div className="flex items-center gap-2 mt-1">
                <code data-testid="referral-code" className="text-amber-400 font-mono font-bold text-base">{walletData?.referral_code || user?.referral_code}</code>
                <button onClick={() => { navigator.clipboard.writeText(walletData?.referral_code || user?.referral_code || ""); toast.success("Copied!"); }} className="text-xs text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded font-display" data-testid="copy-referral-btn">
                  Copy
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-display">Reward per referral</p>
              <p className="text-foreground font-display font-semibold mt-1 flex items-center gap-1"><Gift size={13} className="text-amber-400" />₹50 credit</p>
            </div>
          </div>
        </div>

        {/* Current Plan */}
        {currentPlan !== "free" && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Crown size={18} className="text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-foreground font-display">{currentPlan === "premium" ? "Premium Plan" : "Base Plan"} Active</p>
                {walletData?.subscription_expires_at && (
                  <p className="text-xs text-muted-foreground">Renews: {new Date(walletData.subscription_expires_at).toLocaleDateString("en-IN")}</p>
                )}
              </div>
            </div>
            {currentPlan === "premium" && walletData?.whatsapp_enabled && (
              <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5 font-display" style={{ background: "rgba(37,211,102,0.15)", color: "#25D166" }}>
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
              <div key={plan.id} data-testid={`plan-card-${plan.id}`} className={`bg-white border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 relative overflow-hidden ${plan.popular ? "border-primary/40" : "border-border"}`}>
                {plan.popular && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-display">{plan.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold text-foreground font-display">₹{plan.price}</span>
                      <span className="text-muted-foreground text-xs">/month</span>
                    </div>
                  </div>
                  {plan.popular && <span className="text-xs px-2 py-0.5 rounded-full font-display bg-primary/10 text-primary">Popular</span>}
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check size={12} className="text-primary mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="w-full text-center py-2 text-xs rounded-lg font-display text-emerald-600 border border-emerald-500/30 bg-emerald-500/8">
                    ✓ Current Plan
                  </div>
                ) : (
                  <Button
                    data-testid={`subscribe-${plan.id}-btn`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing === plan.id}
                    className={`w-full font-display font-semibold gap-2 rounded-full ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-0"}`}
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
          <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
            <h3 className="text-sm font-semibold text-foreground font-display mb-4">Transaction History</h3>
            <div className="space-y-2">
              {walletData.transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`transaction-${tx.id}`}>
                  <div>
                    <p className="text-xs text-slate-600 font-display">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono ${tx.type === "credit" ? "text-emerald-500" : "text-red-500"}`}>
                    {tx.type === "credit" ? "+" : "-"}₹{tx.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Split payment info */}
        <div className="p-3 rounded-lg border border-primary/10 bg-primary/4 text-xs text-muted-foreground">
          <span className="text-primary font-display">Smart Billing:</span> Your wallet balance is automatically deducted first during renewals. You only pay the remaining amount via UPI/card.
        </div>
      </div>
    </Layout>
  );
}
