import React from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Video, Star, Shield, Wallet, Calendar, ChevronRight, CheckCircle, Zap, Users, Globe } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: Shield, title: "Verified Professionals", desc: "ID-verified crew with rating history and verified badge.", color: "#2563EB" },
    { icon: Calendar, title: "Smart Calendar", desc: "90-min buffer rule, standby mode, and gig scheduling.", color: "#E05D26" },
    { icon: Wallet, title: "Digital Wallet", desc: "Earn referral credits, manage subscriptions and payouts.", color: "#10B981" },
    { icon: Zap, title: "WhatsApp Alerts", desc: "Accept or reject gigs directly from WhatsApp messages.", color: "#8B5CF6" },
    { icon: Globe, title: "Public Gig Board", desc: "Post roles and get bids from verified crew around India.", color: "#0EA5E9" },
    { icon: Star, title: "Crew Ratings", desc: "Post-event ratings for punctuality, gear, and teamwork.", color: "#F59E0B" },
  ];

  const plans = [
    {
      name: "Base",
      price: "₹69",
      period: "/mo",
      features: ["Verified professional badge", "Unlimited bookings", "In-app & email alerts", "Digital wallet & referrals", "Calendar sync"],
      accent: "#64748B",
    },
    {
      name: "Premium",
      price: "₹99",
      period: "/mo",
      popular: true,
      features: ["Everything in Base", "WhatsApp actionable alerts", "Accept/Reject from WhatsApp", "Sunday schedule dispatch"],
      accent: "#E05D26",
    },
  ];

  return (
    <div className="min-h-screen bg-white font-display">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#E05D26" }}>
              <span className="text-white font-bold text-sm font-display">C</span>
            </div>
            <span className="text-slate-900 text-xl font-semibold font-display">CrewBook</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
              data-testid="nav-login-btn"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/auth")}
              data-testid="nav-signup-btn"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#E05D26" }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-200 bg-orange-50 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span className="text-xs font-medium text-orange-700">For India's Film & Events Industry</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight tracking-tight mb-6">
            Book verified crew.<br />
            <span style={{ color: "#E05D26" }}>Get paid on time.</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-xl mb-8">
            CrewBook connects photographers, videographers, and event crew with verified leads across India. No middlemen, no chasing payments.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              data-testid="hero-cta-btn"
              className="px-6 py-3.5 rounded-xl text-base font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: "#E05D26" }}
            >
              Start for free <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle size={16} className="text-emerald-500" />
              No credit card required
            </div>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-slate-100">
            {[
              { icon: Users, value: "5,000+", label: "Active crew" },
              { icon: Camera, value: "12,000+", label: "Gigs booked" },
              { icon: Star, value: "4.8★", label: "Avg rating" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100">
                  <Icon size={17} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything a crew member needs</h2>
            <p className="text-slate-500">Built for the way India's event industry actually works.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}18` }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-slate-500">Start free — upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-7 relative ${plan.popular ? "border-orange-300 shadow-lg" : "border-slate-200"}`}
                style={{ background: plan.popular ? "rgba(224,93,38,0.02)" : "#fff" }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "#E05D26" }}>
                    Most popular
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-sm font-medium text-slate-500 mb-1">{plan.name} Plan</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                  style={plan.popular
                    ? { background: "#E05D26", color: "#fff" }
                    : { background: "#F1F5F9", color: "#0F172A" }
                  }
                  data-testid={`plan-${plan.name.toLowerCase()}-cta`}
                >
                  Get started
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-400 mt-6">
            Also a free tier available — no card required to explore the platform.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#E05D26" }}>
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-slate-700 font-semibold">CrewBook</span>
          </div>
          <p className="text-sm text-slate-400">Freelance Crew Platform · India · 2025</p>
        </div>
      </footer>
    </div>
  );
}
