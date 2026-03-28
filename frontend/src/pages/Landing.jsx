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
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary">
            <span className="text-white font-bold text-sm font-display">C</span>
          </div>
          <span className="text-foreground font-semibold font-display text-lg">CrewBook</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground text-sm" onClick={() => navigate("/auth")} data-testid="landing-login-btn">
            Sign In
          </Button>
          <Button onClick={() => navigate("/auth")} data-testid="landing-cta-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm font-medium">
            Join Free
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src="https://static.prod-images.emergentagent.com/jobs/24efd653-a840-4159-b811-f10f1d5efb40/images/99170f334a3b9dbfd99a669fc74850313e717f2d1da2767c76985039d5e8a712.png"
            alt="hero background"
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6 text-xs font-display text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Built for Indian Wedding Professionals
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight text-foreground font-display mb-6" style={{ lineHeight: 1.1 }}>
            Book Your Dream<br />
            <span className="text-primary">Wedding Crew</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            The all-in-one platform to find, negotiate, and manage verified second shooters, videographers, and assistants for multi-day events.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button onClick={() => navigate("/auth")} data-testid="hero-get-started-btn" size="lg" className="gap-2 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8">
              Get Started Free <ChevronRight size={16} />
            </Button>
            <Button variant="outline" size="lg" className="border-border text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-full" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-primary" /> No setup fee</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-primary" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-primary" /> UPI + Card payments</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary mb-3 font-display">Platform Features</p>
          <h2 className="text-4xl sm:text-5xl font-light text-foreground font-display">
            Everything a Crew Leader Needs
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-border rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-hover">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 bg-primary/10">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2 font-display">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-primary mb-3 font-display">Simple Pricing</p>
          <h2 className="text-4xl sm:text-5xl font-light text-foreground font-display">
            Start at ₹69 / Month
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRICING.map((plan) => (
            <div key={plan.name} className={`bg-white rounded-3xl border relative overflow-hidden p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${plan.popular ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
              {plan.popular && (
                <span className="absolute top-4 right-4 text-xs px-3 py-1 rounded-full font-display font-medium bg-primary/10 text-primary">
                  Most Popular
                </span>
              )}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground font-display mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground font-display">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check size={14} className="text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                data-testid={`pricing-${plan.name.toLowerCase().replace(' ', '-')}-btn`}
                onClick={() => navigate("/auth")}
                className={`w-full font-semibold rounded-full ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border text-center bg-white">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs">C</span>
          </div>
          <span className="text-foreground font-semibold font-display">CrewBook</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2025 CrewBook. Built for Indian Wedding Professionals.</p>
      </footer>
    </div>
  );
}
