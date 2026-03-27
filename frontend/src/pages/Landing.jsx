import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Video, Star, Shield, Users, Zap, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Shield, title: "Verified Professionals", desc: "Every crew member is ID-verified by our admin team. Trust, guaranteed." },
  { icon: Users, title: "Multi-Day Booking Engine", desc: "Handle complex weddings with parent-child gig structure. Haldi, Reception, all in one place." },
  { icon: Zap, title: "Negotiate in Real-Time", desc: "Quote → Counter → Accept flow locks in fees with a digital agreement." },
  { icon: Star, title: "Anonymous Ratings", desc: "Honest feedback on Punctuality, Gear Handling & Teamwork. No bias, just merit." },
  { icon: Camera, title: "Gear Vault", desc: "Showcase your camera bodies, lenses, drones. Let your gear do the talking." },
  { icon: Video, title: "WhatsApp Alerts", desc: "Get gig invites with Accept/Reject buttons straight to WhatsApp. Never miss a booking." },
];

const PRICING = [
  {
    name: "Base Plan",
    price: "₹69",
    period: "/month",
    features: ["Verified professional badge", "Unlimited gig bookings", "In-app & email notifications", "Digital wallet & referrals", "Calendar & availability sync", "Gear vault showcase"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Premium Plan",
    price: "₹99",
    period: "/month",
    features: ["Everything in Base", "WhatsApp actionable alerts", "Accept/Reject from WhatsApp", "Sunday schedule dispatch", "Priority in search results"],
    cta: "Go Premium",
    popular: true,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A", color: "#fff" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4" style={{ background: "rgba(10,10,10,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F59E0B" }}>
            <span className="text-black font-bold text-sm font-display">C</span>
          </div>
          <span className="text-white font-semibold font-display text-lg">CrewBook</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-zinc-400 hover:text-white text-sm" onClick={() => navigate("/auth")} data-testid="landing-login-btn">
            Sign In
          </Button>
          <Button onClick={() => navigate("/auth")} data-testid="landing-cta-btn" className="text-sm font-medium" style={{ background: "#F59E0B", color: "#000" }}>
            Join Free
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1554844453-7ea2a562a6c8?auto=format&fit=crop&w=1920&q=80"
            alt="photographer"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.6), rgba(10,10,10,0.95))" }} />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6 text-xs font-display" style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Built for Indian Wedding Professionals
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight text-white mb-6" style={{ fontFamily: "Cormorant Garamond, serif", lineHeight: 1.1 }}>
            Book Your Dream<br />
            <span style={{ color: "#F59E0B" }}>Wedding Crew</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto font-body leading-relaxed">
            The all-in-one platform to find, negotiate, and manage verified second shooters, videographers, and assistants for multi-day events.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button onClick={() => navigate("/auth")} data-testid="hero-get-started-btn" size="lg" className="gap-2 font-semibold" style={{ background: "#F59E0B", color: "#000", padding: "12px 28px" }}>
              Get Started Free <ChevronRight size={16} />
            </Button>
            <Button variant="outline" size="lg" className="border-white/10 text-zinc-300 hover:text-white hover:border-white/30" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-12 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-500" /> No setup fee</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-500" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-500" /> UPI + Card payments</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-amber-500 mb-3 font-display">Platform Features</p>
          <h2 className="text-4xl sm:text-5xl font-light text-white" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            Everything a Crew Leader Needs
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border card-hover" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(245,158,11,0.12)" }}>
                <Icon size={18} style={{ color: "#F59E0B" }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 font-display">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-amber-500 mb-3 font-display">Simple Pricing</p>
          <h2 className="text-4xl sm:text-5xl font-light text-white" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            Start at ₹69 / Month
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRICING.map((plan) => (
            <div key={plan.name} className={`p-8 rounded-2xl border relative overflow-hidden ${plan.popular ? "border-amber-500/50" : "border-white/10"}`} style={{ background: "#131315" }}>
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #F59E0B, transparent)" }} />
              )}
              {plan.popular && (
                <span className="absolute top-4 right-4 text-xs px-2 py-0.5 rounded-full font-display font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                  Most Popular
                </span>
              )}
              <div className="mb-6">
                <p className="text-sm text-zinc-400 font-display mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white font-display">{plan.price}</span>
                  <span className="text-zinc-500 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check size={14} className="text-amber-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                data-testid={`pricing-${plan.name.toLowerCase().replace(' ', '-')}-btn`}
                onClick={() => navigate("/auth")}
                className="w-full font-semibold"
                style={plan.popular ? { background: "#F59E0B", color: "#000" } : { background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
            <span className="text-black font-bold text-xs">C</span>
          </div>
          <span className="text-white font-semibold font-display">CrewBook</span>
        </div>
        <p className="text-xs text-zinc-600">© 2025 CrewBook. Built for Indian Wedding Professionals.</p>
      </footer>
    </div>
  );
}
