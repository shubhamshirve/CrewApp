# Light Theme Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Read `CLAUDE.md` before starting. Update `CLAUDE.md` when your task is complete.

**Goal:** Complete the transition from dark luxury theme to Light, Minimal, Rounded UI across all React pages and components on branch `1.7`.

**Architecture:** The CSS variables and Tailwind config are already updated (`index.css` has light theme vars, `tailwind.config.js` has rounded scale). The work is purely in React components — replacing hard-coded dark `style={{}}` and dark Tailwind classes with the new design token classes. No backend changes.

**Tech Stack:** React 18, Tailwind CSS, Radix UI, lucide-react. Branch: `1.7`.

---

## Design Token Reference

Use these mappings in every task below. **Never re-introduce hex colors that are already in CSS variables.**

| Old (dark) | New (light) |
|---|---|
| `style={{ background: "#0A0A0A" }}` or `#131315` | `className="bg-background"` or `className="bg-white"` |
| `text-white` (on dark bg) | `text-foreground` or `text-slate-900` |
| `text-zinc-400`, `text-zinc-500` | `text-muted-foreground` |
| `text-zinc-300` | `text-slate-600` |
| `border-white/10`, `borderColor: "rgba(255,255,255,0.07)"` | `border-border` |
| `bg-zinc-900` (input) | `bg-slate-50` |
| `bg-zinc-800`, `bg-zinc-700` | `bg-slate-100` |
| `#F59E0B` (old amber accent) | `hsl(var(--primary))` = `#E05D26` — use `text-primary`, `bg-primary` |
| `Cormorant Garamond, serif` in `style={}` | Remove — `font-display` (`Outfit`) is the CSS default for headings |
| Card: `style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}` | `className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"` |
| Input `inputClass` dark string | `"bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/50 rounded-xl"` |
| Ghost button dark: `border-white/10 text-zinc-300 hover:text-white` | `border-border text-slate-600 hover:text-foreground hover:bg-slate-50` |
| Primary button `style={{ background: "#F59E0B", color: "#000" }}` | `className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"` |

**Card pattern** (use everywhere):
```jsx
<div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
```

**Section heading pattern:**
```jsx
<p className="text-xs uppercase tracking-widest text-primary mb-3 font-display">Label</p>
<h2 className="text-4xl sm:text-5xl font-light text-foreground font-display">Title</h2>
```

---

## Files Modified

| File | Action |
|---|---|
| `frontend/src/pages/Landing.jsx` | Full rewrite to light theme |
| `frontend/src/pages/Auth.jsx` | Full rewrite to light theme |
| `frontend/src/pages/Onboarding.jsx` | Full rewrite to light theme |
| `frontend/src/pages/AdminLogin.jsx` | Full rewrite to light theme |
| `frontend/src/pages/Dashboard.jsx` | Remove remaining dark classes |
| `frontend/src/pages/GigBoard.jsx` | Full rewrite (39 dark occurrences) |
| `frontend/src/pages/Gigs.jsx` | Remove dark classes |
| `frontend/src/pages/GigDetail.jsx` | Remove remaining dark classes |
| `frontend/src/pages/Profile.jsx` | Remove remaining dark classes |
| `frontend/src/pages/Search.jsx` | Remove dark classes |
| `frontend/src/pages/Connections.jsx` | Remove dark classes |
| `frontend/src/pages/Notifications.jsx` | Remove dark classes |
| `frontend/src/pages/Wallet.jsx` | Remove dark classes |
| `frontend/src/pages/Calendar.jsx` | Remove remaining dark classes |
| `frontend/src/pages/AdminDashboard.jsx` | Full rewrite to light theme |
| `frontend/src/pages/admin/AdminOverview.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminUsers.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminVerification.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminPenalties.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminSettings.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminTemplates.jsx` | Remove remaining dark classes |
| `frontend/src/pages/admin/AdminLogs.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminGigBoard.jsx` | Remove dark classes |
| `frontend/src/pages/admin/AdminUserProfile.jsx` | Remove dark classes |
| `CLAUDE.md` | Update design system section |

---

## Task 1: Landing Page

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`

- [ ] **Step 1: Replace the page wrapper and navbar**

  Change:
  ```jsx
  <div className="min-h-screen" style={{ background: "#0A0A0A", color: "#fff" }}>
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ background: "rgba(10,10,10,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
  ```
  To:
  ```jsx
  <div className="min-h-screen bg-background">
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-border">
  ```

- [ ] **Step 2: Update navbar logo and buttons**

  Change navbar logo:
  ```jsx
  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F59E0B" }}>
    <span className="text-black font-bold text-sm font-display">C</span>
  </div>
  <span className="text-white font-semibold font-display text-lg">CrewBook</span>
  ```
  To:
  ```jsx
  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary">
    <span className="text-white font-bold text-sm font-display">C</span>
  </div>
  <span className="text-foreground font-semibold font-display text-lg">CrewBook</span>
  ```

  Change navbar buttons:
  ```jsx
  <Button variant="ghost" className="text-zinc-400 hover:text-white text-sm" ...>Sign In</Button>
  <Button ... style={{ background: "#F59E0B", color: "#000" }}>Join Free</Button>
  ```
  To:
  ```jsx
  <Button variant="ghost" className="text-muted-foreground hover:text-foreground text-sm" ...>Sign In</Button>
  <Button ... className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm font-medium">Join Free</Button>
  ```

- [ ] **Step 3: Rewrite Hero section**

  Replace the entire `<section className="relative min-h-screen ...">` with a light hero:
  ```jsx
  {/* Hero */}
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
    <div className="absolute inset-0 z-0">
      <img
        src="https://static.prod-images.emergentagent.com/jobs/24efd653-a840-4159-b811-f10f1d5efb40/images/99170f334a3b9dbfd99a669fc74850313e717f2d1da2767c76985039d5e8a712.png"
        alt="hero background"
        className="w-full h-full object-cover opacity-30"
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
  ```

- [ ] **Step 4: Rewrite Features section**

  Replace Features section:
  ```jsx
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
  ```

- [ ] **Step 5: Rewrite Pricing section**

  Replace Pricing section:
  ```jsx
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
  ```

- [ ] **Step 6: Rewrite Footer**

  Replace footer:
  ```jsx
  <footer className="py-10 px-6 border-t border-border text-center bg-white">
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-xs">C</span>
      </div>
      <span className="text-foreground font-semibold font-display">CrewBook</span>
    </div>
    <p className="text-xs text-muted-foreground">© 2025 CrewBook. Built for Indian Wedding Professionals.</p>
  </footer>
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/pages/Landing.jsx
  git commit -m "feat: convert Landing page to light minimal theme"
  ```

---

## Task 2: Auth Page

**Files:**
- Modify: `frontend/src/pages/Auth.jsx`

- [ ] **Step 1: Replace inputClass constant and page wrapper**

  Change:
  ```jsx
  const inputClass = "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-amber-500/20";
  ```
  To:
  ```jsx
  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 rounded-xl";
  ```

  Change page wrapper:
  ```jsx
  <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0A0A0A" }}>
  ```
  To:
  ```jsx
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
  ```

- [ ] **Step 2: Update logo, back button, and card**

  Change back button:
  ```jsx
  <button ... className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-8 transition-colors" ...>
  ```
  To:
  ```jsx
  <button ... className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors" ...>
  ```

  Change logo:
  ```jsx
  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F59E0B" }}>
    <span className="text-black font-bold font-display">C</span>
  </div>
  <span className="text-white text-xl font-semibold font-display">CrewBook</span>
  ```
  To:
  ```jsx
  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary">
    <span className="text-white font-bold font-display">C</span>
  </div>
  <span className="text-foreground text-xl font-semibold font-display">CrewBook</span>
  ```

  Change card wrapper:
  ```jsx
  <div className="p-6 rounded-2xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.08)" }}>
  ```
  To:
  ```jsx
  <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
  ```

- [ ] **Step 3: Update TabsList and TabsTrigger**

  Change:
  ```jsx
  <TabsList className="w-full mb-6 bg-zinc-900 border border-white/5">
    <TabsTrigger value="login" ... className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-display">
    <TabsTrigger value="register" ... className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-display">
  ```
  To:
  ```jsx
  <TabsList className="w-full mb-6 bg-slate-100 border border-border">
    <TabsTrigger value="login" ... className="flex-1 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display">
    <TabsTrigger value="register" ... className="flex-1 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display">
  ```

- [ ] **Step 4: Update Labels, submit buttons, admin hint**

  Change all `<Label className="text-zinc-300 ...">` to `<Label className="text-slate-700 ...">`.

  Change submit buttons:
  ```jsx
  <Button ... className="w-full font-semibold font-display mt-2" style={{ background: "#F59E0B", color: "#000" }} ...>
  ```
  To:
  ```jsx
  <Button ... className="w-full font-semibold font-display mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" ...>
  ```

  Change admin hint:
  ```jsx
  <p className="text-center text-xs text-zinc-600 mt-3">
  ```
  To:
  ```jsx
  <p className="text-center text-xs text-muted-foreground mt-3">
  ```

  Change password toggle button:
  ```jsx
  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
  ```
  To:
  ```jsx
  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/Auth.jsx
  git commit -m "feat: convert Auth page to light minimal theme"
  ```

---

## Task 3: Onboarding Page

**Files:**
- Modify: `frontend/src/pages/Onboarding.jsx`

- [ ] **Step 1: Replace inputClass and page wrapper**

  Change:
  ```jsx
  const inputClass = "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500/50";
  ```
  To:
  ```jsx
  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 rounded-xl";
  ```

  Change page wrapper:
  ```jsx
  <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0A0A0A" }}>
  ```
  To:
  ```jsx
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
  ```

- [ ] **Step 2: Update logo and step progress bar**

  Change logo:
  ```jsx
  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F59E0B" }}>
    <span className="text-black ...">C</span>
  </div>
  <span className="text-white font-semibold font-display text-lg">CrewBook</span>
  ```
  To:
  ```jsx
  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary">
    <span className="text-white font-bold text-sm font-display">C</span>
  </div>
  <span className="text-foreground font-semibold font-display text-lg">CrewBook</span>
  ```

  Change step indicators:
  ```jsx
  <div className={`w-7 h-7 rounded-full ... ${i < step ? "bg-amber-500" : i === step ? "bg-amber-500" : "bg-zinc-800 text-zinc-500"}`} style={{ color: i <= step ? "#000" : undefined }}>
  ```
  To:
  ```jsx
  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
  ```

  Change step connector lines:
  ```jsx
  <div className={`flex-1 h-px ${i < step ? "bg-amber-500" : "bg-zinc-800"}`} />
  ```
  To:
  ```jsx
  <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />
  ```

- [ ] **Step 3: Update card wrapper and headings**

  Change card:
  ```jsx
  <div className="p-6 rounded-2xl border" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.08)" }}>
  ```
  To:
  ```jsx
  <div className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
  ```

  Change all step headings:
  ```jsx
  <h2 className="text-xl font-semibold text-white font-display mb-4">
  ```
  To:
  ```jsx
  <h2 className="text-xl font-semibold text-foreground font-display mb-4">
  ```

- [ ] **Step 4: Update gear items, upload zones, buttons**

  Change gear item chips:
  ```jsx
  <span ... className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#1C1C1F", color: "#a1a1aa" }}>
  ```
  To:
  ```jsx
  <span ... className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-slate-50 text-slate-600 text-xs">
  ```

  Change upload zones (both govt-id and selfie):
  ```jsx
  <label ... className="... border-2 border-dashed rounded-lg cursor-pointer hover:border-amber-500/50 transition-colors" style={{ borderColor: ..., background: "#0D0D0F" }}>
  ```
  To:
  ```jsx
  <label ... className="mt-1 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:border-primary/50 transition-colors bg-slate-50 border-border">
  ```

  Change "Back" buttons:
  ```jsx
  <Button variant="outline" onClick={() => setStep(...)} className="border-white/10 text-zinc-400 hover:text-white">Back</Button>
  ```
  To:
  ```jsx
  <Button variant="outline" onClick={() => setStep(...)} className="border-border text-slate-600 hover:text-foreground rounded-full">Back</Button>
  ```

  Change primary action buttons (all 3 step submit buttons + final button):
  ```jsx
  <Button ... className="... font-semibold font-display" style={{ background: "#F59E0B", color: "#000" }} ...>
  ```
  To:
  ```jsx
  <Button ... className="... font-semibold font-display bg-primary text-primary-foreground hover:bg-primary/90 rounded-full" ...>
  ```

- [ ] **Step 5: Update completion screen**

  Change:
  ```jsx
  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(245,158,11,0.15)" }}>
  ```
  To:
  ```jsx
  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-primary/10">
  ```

  Change completion heading:
  ```jsx
  <h2 className="text-2xl font-semibold text-white font-display">Profile Complete!</h2>
  ```
  To:
  ```jsx
  <h2 className="text-2xl font-semibold text-foreground font-display">Profile Complete!</h2>
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/pages/Onboarding.jsx
  git commit -m "feat: convert Onboarding page to light minimal theme"
  ```

---

## Task 4: Admin Login Page

**Files:**
- Modify: `frontend/src/pages/AdminLogin.jsx`

- [ ] **Step 1: Read the file first**

  Run: `cat frontend/src/pages/AdminLogin.jsx`

- [ ] **Step 2: Replace page wrapper and card**

  Change the outer wrapper (dark gradient):
  ```jsx
  style={{ background: "linear-gradient(135deg, #080B12 0%, #0D1220 100%)" }}
  ```
  Replace the entire page structure to:
  ```jsx
  <div className="min-h-screen flex items-center justify-center p-4 bg-background">
    <div className="w-full max-w-sm">
  ```

  Change the card:
  ```jsx
  style={{ background: "rgba(13, 18, 32, 0.8)", backdropFilter: "blur(20px)" }}
  ```
  To:
  ```jsx
  className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8"
  ```

- [ ] **Step 3: Update logo, heading, inputs, and button**

  Logo shield container:
  ```jsx
  style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}
  ```
  To:
  ```jsx
  className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4"
  ```

  Heading:
  ```jsx
  <h1 className="text-3xl font-bold text-white font-display">Admin Panel</h1>
  ```
  To:
  ```jsx
  <h1 className="text-3xl font-bold text-foreground font-display text-center">Admin Panel</h1>
  ```

  Inputs (both email and password):
  ```jsx
  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 ..."
  style={{ background: "rgba(255,255,255,0.04)" }}
  ```
  To:
  ```jsx
  className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-slate-50 border border-border focus:outline-none focus:border-blue-500/50 transition-colors"
  ```
  (Remove the `style` prop entirely.)

  Password toggle icon color:
  ```jsx
  className="... text-zinc-500 hover:text-zinc-300"
  ```
  To:
  ```jsx
  className="... text-muted-foreground hover:text-foreground"
  ```

  Submit button:
  ```jsx
  className="w-full py-3 rounded-xl text-sm font-semibold text-white ..."
  style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}
  ```
  To:
  ```jsx
  className="w-full py-3 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
  ```
  (Remove the `style` prop.)

- [ ] **Step 4: Update any remaining text colors**

  Any `text-zinc-*` or `text-white` labels → `text-slate-700` for labels, `text-muted-foreground` for hints/errors.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/AdminLogin.jsx
  git commit -m "feat: convert AdminLogin to light minimal theme"
  ```

---

## Task 5: Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Read the file**

  Run: `cat frontend/src/pages/Dashboard.jsx`

- [ ] **Step 2: Fix stat card and status badge**

  Find:
  ```jsx
  not_submitted: { label: "ID Not Submitted", color: "bg-zinc-700 text-zinc-300", icon: AlertCircle },
  ```
  Change to:
  ```jsx
  not_submitted: { label: "ID Not Submitted", color: "bg-slate-100 text-slate-500", icon: AlertCircle },
  ```

  Find stat card (line ~117):
  ```jsx
  <p className="text-2xl font-bold text-white font-display">{value}</p>
  ```
  To:
  ```jsx
  <p className="text-2xl font-bold text-foreground font-display">{value}</p>
  ```

- [ ] **Step 3: Fix welcome heading and verification banner**

  Find:
  ```jsx
  <h1 className="text-2xl text-white font-display font-semibold">
  ```
  To:
  ```jsx
  <h1 className="text-2xl text-foreground font-display font-semibold">
  ```

  Fix all remaining `text-white` that appear inside cards/sections to `text-foreground`.

- [ ] **Step 4: Fix verification CTA card**

  Find the verification/onboarding card and change:
  ```jsx
  <p className="text-sm font-medium text-white font-display">Complete your verification</p>
  ```
  To:
  ```jsx
  <p className="text-sm font-medium text-foreground font-display">Complete your verification</p>
  ```

- [ ] **Step 5: Fix cards — remove all dark inline styles**

  Search for any remaining `style={{ background: "#` or `style={{ borderColor:` in `Dashboard.jsx` and replace with Tailwind equivalents using `bg-white border-border`.

  Fix section headings like:
  ```jsx
  <h3 className="text-sm font-semibold text-white font-display">Pending Invites</h3>
  ```
  To:
  ```jsx
  <h3 className="text-sm font-semibold text-foreground font-display">Pending Invites</h3>
  ```

- [ ] **Step 6: Fix modals/dialogs dark styles**

  Any `DialogTitle className="text-white"` → `DialogTitle className="text-foreground"`.
  Any `className="... bg-zinc-900 border border-white/10 text-white ..."` inputs inside dialogs → use the light inputClass pattern.

- [ ] **Step 7: Fix invite/activity list items**

  All `text-white` on item titles inside lists → `text-foreground`.
  All `border-white/10` → `border-border`.
  Buttons `text-xs border-white/10 text-zinc-300 hover:text-white` → `text-xs border-border text-slate-600 hover:text-foreground hover:bg-slate-50`.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/pages/Dashboard.jsx
  git commit -m "feat: convert Dashboard page to light minimal theme"
  ```

---

## Task 6: GigBoard Page

**Files:**
- Modify: `frontend/src/pages/GigBoard.jsx`

This is the largest file (1064 lines, 39 dark class occurrences). Work through it systematically.

- [ ] **Step 1: Read the file**

  Run: `cat frontend/src/pages/GigBoard.jsx`

- [ ] **Step 2: Replace all dark inputClass constants**

  Find any `inputClass` or inline dark input classes like `bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600` and replace with:
  ```
  bg-slate-50 border-border text-foreground placeholder:text-muted-foreground rounded-xl
  ```

- [ ] **Step 3: Replace page/section wrappers**

  Find any outer wrapper with dark background inline style and replace with `bg-background`.

- [ ] **Step 4: Replace all card inline dark styles**

  Pattern to find:
  ```jsx
  style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}
  // or
  style={{ background: "#0F1628", ... }}
  ```
  Replace all with Tailwind card class:
  ```jsx
  className="bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
  ```

- [ ] **Step 5: Replace all `text-white` on text content**

  Every `text-white` on headings, labels, card titles, table cells → `text-foreground`.

- [ ] **Step 6: Replace `text-zinc-400` / `text-zinc-500` / `text-zinc-300`**

  - `text-zinc-400`, `text-zinc-500` → `text-muted-foreground`
  - `text-zinc-300` → `text-slate-600`

- [ ] **Step 7: Replace border classes**

  All `border-white/10`, `border-white/5` → `border-border`.

- [ ] **Step 8: Replace bg-zinc-* backgrounds (non-input)**

  - `bg-zinc-800`, `bg-zinc-900` used as badges/chips → `bg-slate-100 text-slate-600`
  - `bg-zinc-700 text-zinc-300` status badges → `bg-slate-100 text-slate-500`

- [ ] **Step 9: Replace amber accent with primary**

  All `text-amber-500`, `bg-amber-500`, `border-amber-500` → `text-primary`, `bg-primary`, `border-primary`.
  All `#F59E0B` in `style={}` → remove style, use `text-primary` or `bg-primary`.

- [ ] **Step 10: Replace all primary action button dark styles**

  All `style={{ background: "#F59E0B", color: "#000" }}` or similar on `<Button>` → remove style, add `className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"`.

- [ ] **Step 11: Replace filter/tab bars**

  Any dark `bg-zinc-900` used as a tab/filter bar → `bg-slate-100`.

- [ ] **Step 12: Commit**

  ```bash
  git add frontend/src/pages/GigBoard.jsx
  git commit -m "feat: convert GigBoard page to light minimal theme"
  ```

---

## Task 7: Gigs, GigDetail, Profile Pages

**Files:**
- Modify: `frontend/src/pages/Gigs.jsx`
- Modify: `frontend/src/pages/GigDetail.jsx`
- Modify: `frontend/src/pages/Profile.jsx`

- [ ] **Step 1: Read all three files**

  Run:
  ```bash
  cat frontend/src/pages/Gigs.jsx
  cat frontend/src/pages/GigDetail.jsx
  cat frontend/src/pages/Profile.jsx
  ```

- [ ] **Step 2: Apply the standard dark→light mapping to Gigs.jsx**

  Apply the token mapping table at the top of this plan:
  - `text-white` → `text-foreground`
  - Dark inline `style={{ background: ... }}` on cards → `bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]`
  - `bg-zinc-900` inputs → `bg-slate-50 border-border`
  - `#F59E0B` accents → `text-primary` / `bg-primary`
  - `text-zinc-400` → `text-muted-foreground`
  - `border-white/10` → `border-border`

- [ ] **Step 3: Apply standard mapping to GigDetail.jsx**

  Same mapping as Step 2. Pay attention to the hero/cover image section — any dark overlay `style={{ background: "linear-gradient(to bottom, rgba(0,0,0,...), ..." }}` should use a light gradient:
  ```jsx
  style={{ background: "linear-gradient(to bottom, rgba(249,249,248,0), rgba(249,249,248,0.95))" }}
  ```

- [ ] **Step 4: Apply standard mapping to Profile.jsx**

  Same mapping. The profile header background strip (if any dark bg) → `bg-slate-50` or `bg-white`.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/Gigs.jsx frontend/src/pages/GigDetail.jsx frontend/src/pages/Profile.jsx
  git commit -m "feat: convert Gigs, GigDetail, Profile pages to light theme"
  ```

---

## Task 8: Search, Connections, Notifications Pages

**Files:**
- Modify: `frontend/src/pages/Search.jsx`
- Modify: `frontend/src/pages/Connections.jsx`
- Modify: `frontend/src/pages/Notifications.jsx`

- [ ] **Step 1: Read all three files**

  Run:
  ```bash
  cat frontend/src/pages/Search.jsx
  cat frontend/src/pages/Connections.jsx
  cat frontend/src/pages/Notifications.jsx
  ```

- [ ] **Step 2: Apply standard dark→light mapping to all three files**

  Use the token mapping table from the top of this plan. For each file:
  - Page title headings `text-white` → `text-foreground`
  - User/crew cards: dark inline styles → `bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]`
  - Empty state text `text-zinc-400` → `text-muted-foreground`
  - Action buttons: remove dark style, use `rounded-full` + `bg-primary text-primary-foreground` for primary, `border-border text-slate-600` for secondary
  - Notification items: replace dark bg with `bg-white` or `bg-slate-50` for unread highlight

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/Search.jsx frontend/src/pages/Connections.jsx frontend/src/pages/Notifications.jsx
  git commit -m "feat: convert Search, Connections, Notifications to light theme"
  ```

---

## Task 9: Wallet and Calendar Pages

**Files:**
- Modify: `frontend/src/pages/Wallet.jsx`
- Modify: `frontend/src/pages/Calendar.jsx`

- [ ] **Step 1: Read both files**

  Run:
  ```bash
  cat frontend/src/pages/Wallet.jsx
  cat frontend/src/pages/Calendar.jsx
  ```

- [ ] **Step 2: Apply standard mapping to Wallet.jsx**

  Key patterns to fix:
  - `<h1 className="text-2xl font-semibold text-white font-display">Wallet & Subscription</h1>` → `text-foreground`
  - Balance display `text-4xl font-bold text-white` → `text-foreground`
  - Plan cards dark bg → `bg-white border border-border rounded-3xl`
  - Plan price `text-3xl font-bold text-white` → `text-foreground`
  - Transaction history card heading `text-white` → `text-foreground`
  - Plan active badge text `text-white` → `text-foreground`
  - Gift credit `text-white` with amber star → keep amber-400 star but `text-foreground` for surrounding text

- [ ] **Step 3: Apply standard mapping to Calendar.jsx**

  Key patterns:
  - Any remaining dark card backgrounds → `bg-white border border-border rounded-3xl`
  - Any `text-white` on calendar day cells or event titles → `text-foreground`
  - Selected day highlight: change from dark to `bg-primary text-white rounded-full`
  - Today highlight: `bg-primary/10 text-primary rounded-full`

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/Wallet.jsx frontend/src/pages/Calendar.jsx
  git commit -m "feat: convert Wallet and Calendar pages to light theme"
  ```

---

## Task 10: AdminDashboard Page

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Read the file**

  Run: `cat frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 2: Fix inputClass and stat cards**

  Change:
  ```jsx
  const inputClass = "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500/50";
  ```
  To:
  ```jsx
  const inputClass = "bg-slate-50 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 rounded-xl";
  ```

  Fix stat cards:
  ```jsx
  style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}
  ```
  → `className="bg-white border border-border rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"`

- [ ] **Step 3: Fix all remaining text-white and dark styles**

  Apply standard mapping. Admin accent color stays blue (`text-blue-600`, `bg-blue-600`) — don't convert admin-specific blue to orange primary.

  Pattern for admin-specific changes:
  - `text-white` on content → `text-foreground`
  - `bg-zinc-900` tabs bar → `bg-slate-100`
  - `bg-zinc-700/50 text-zinc-400` badges → `bg-slate-100 text-slate-500`
  - `bg-amber-500/15 text-amber-400` subscription badges → `bg-primary/10 text-primary`
  - Dialog dark bg: `style={{ background: "#131315", borderColor: "rgba(255,255,255,0.1)" }}` → `className="bg-white"` (DialogContent handles border)
  - `DialogTitle className="text-white"` → `DialogTitle className="text-foreground"`

- [ ] **Step 4: Fix user row items and verify cards**

  User cards dark bg → `bg-white border border-border rounded-2xl`.
  Avatar circle amber: keep `bg-primary/10 text-primary` (orange) for user avatars, keep `bg-blue-50 text-blue-600` for admin-specific actions.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/AdminDashboard.jsx
  git commit -m "feat: convert AdminDashboard to light minimal theme"
  ```

---

## Task 11: Admin Pages — Overview, Verification, Penalties

**Files:**
- Modify: `frontend/src/pages/admin/AdminOverview.jsx`
- Modify: `frontend/src/pages/admin/AdminVerification.jsx`
- Modify: `frontend/src/pages/admin/AdminPenalties.jsx`

- [ ] **Step 1: Read all three files**

  Run:
  ```bash
  cat frontend/src/pages/admin/AdminOverview.jsx
  cat frontend/src/pages/admin/AdminVerification.jsx
  cat frontend/src/pages/admin/AdminPenalties.jsx
  ```

- [ ] **Step 2: Apply standard mapping to all three**

  Use the token table. Admin-specific note: admin accent is **blue** (`bg-blue-600`, `text-blue-600`), not orange. Preserve blue accents for admin action buttons. Only convert dark backgrounds and `text-white` on content.

  For `AdminPenalties.jsx`:
  - Warning/penalty styling: replace `bg-red-900/20 text-red-400` → `bg-red-50 text-red-600`
  - Penalty cards dark bg → `bg-white border border-border rounded-2xl`

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/admin/AdminOverview.jsx frontend/src/pages/admin/AdminVerification.jsx frontend/src/pages/admin/AdminPenalties.jsx
  git commit -m "feat: convert AdminOverview, AdminVerification, AdminPenalties to light theme"
  ```

---

## Task 12: Admin Pages — Users, UserProfile

**Files:**
- Modify: `frontend/src/pages/admin/AdminUsers.jsx`
- Modify: `frontend/src/pages/admin/AdminUserProfile.jsx`

- [ ] **Step 1: Read both files**

  Run:
  ```bash
  cat frontend/src/pages/admin/AdminUsers.jsx
  cat frontend/src/pages/admin/AdminUserProfile.jsx
  ```

- [ ] **Step 2: Apply standard mapping to AdminUsers.jsx**

  This file is 478 lines. Systematic approach:
  - Search & replace all `text-white` → `text-foreground` (on content, not on colored bg icons)
  - All card dark inline styles → `bg-white border border-border rounded-2xl`
  - All `bg-zinc-*` → appropriate slate equivalents
  - All `border-white/10` → `border-border`
  - Admin blue buttons stay blue; user subscription badge amber → `bg-primary/10 text-primary`

- [ ] **Step 3: Apply standard mapping to AdminUserProfile.jsx**

  This file is 552 lines. Same pattern:
  - Profile header section if it has a dark bg strip → `bg-white border-b border-border`
  - All stat cards → `bg-white border border-border rounded-2xl`
  - All content `text-white` → `text-foreground`
  - Timeline items dark bg → `bg-white border border-border`

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/admin/AdminUsers.jsx frontend/src/pages/admin/AdminUserProfile.jsx
  git commit -m "feat: convert AdminUsers, AdminUserProfile to light theme"
  ```

---

## Task 13: Admin Pages — Settings, Templates, Logs, GigBoard

**Files:**
- Modify: `frontend/src/pages/admin/AdminSettings.jsx`
- Modify: `frontend/src/pages/admin/AdminTemplates.jsx`
- Modify: `frontend/src/pages/admin/AdminLogs.jsx`
- Modify: `frontend/src/pages/admin/AdminGigBoard.jsx`

- [ ] **Step 1: Read all four files**

  Run:
  ```bash
  cat frontend/src/pages/admin/AdminSettings.jsx
  cat frontend/src/pages/admin/AdminTemplates.jsx
  cat frontend/src/pages/admin/AdminLogs.jsx
  cat frontend/src/pages/admin/AdminGigBoard.jsx
  ```

- [ ] **Step 2: Apply standard mapping to AdminSettings.jsx** (426 lines)

  - Settings section cards dark bg → `bg-white border border-border rounded-2xl`
  - Form inputs dark → light inputClass pattern
  - `text-white` labels/values → `text-foreground`
  - Section dividers `border-white/10` → `border-border`

- [ ] **Step 3: Apply standard mapping to AdminTemplates.jsx** (353 lines, partially done)

  Check for remaining dark classes:
  ```bash
  grep -n "text-white\|bg-zinc\|bg-\[#\|bg-gray-9\|bg-slate-9\|border-white" frontend/src/pages/admin/AdminTemplates.jsx
  ```
  Fix any remaining occurrences with standard mapping.

- [ ] **Step 4: Apply standard mapping to AdminLogs.jsx** (370 lines)

  - Tab bar dark → `bg-slate-100`
  - Log entry rows dark → `bg-white border-b border-border hover:bg-slate-50`
  - Status code badges: keep semantic colors (green for 2xx, red for 5xx, etc.) but use light variants:
    - `bg-emerald-500/15 text-emerald-600` for success
    - `bg-red-500/15 text-red-600` for errors
    - `bg-amber-500/15 text-amber-600` for warnings
  - Filter inputs → light inputClass

- [ ] **Step 5: Apply standard mapping to AdminGigBoard.jsx** (106 lines)

  Small file — straightforward apply of token mapping.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/pages/admin/AdminSettings.jsx frontend/src/pages/admin/AdminTemplates.jsx frontend/src/pages/admin/AdminLogs.jsx frontend/src/pages/admin/AdminGigBoard.jsx
  git commit -m "feat: convert AdminSettings, AdminTemplates, AdminLogs, AdminGigBoard to light theme"
  ```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read CLAUDE.md**

  Run: `cat CLAUDE.md`

- [ ] **Step 2: Update the Design System section**

  Find:
  ```markdown
  **Design system:** Dark luxury theme. Card backgrounds `#0F1628`, page background `#080B12`, blue active accents. Source of truth: `docs/design_guidelines.json`.
  ```
  Replace with:
  ```markdown
  **Design system:** Light, Minimal, Rounded UI. Page background `#F9F9F8`, cards `#FFFFFF`, primary accent `#E05D26` (Cinematic Amber). Fonts: Outfit (headings), Manrope (body). Radii: `rounded-3xl` cards, `rounded-full` buttons. Source of truth: `docs/design_guidelines.json`.
  ```

- [ ] **Step 3: Add agent startup/update instructions**

  At the top of the `## Key Conventions` section (or as a new section after `## Project Overview`), add:

  ```markdown
  ## Agent Protocol

  Every agent (subagent or main) working in this repo MUST:
  1. **On start:** Read `CLAUDE.md` fully before writing any code.
  2. **On finish:** Update `CLAUDE.md` if any conventions, stack, or design system info has changed.

  This keeps all agents in sync without needing to re-explore the codebase.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md for light theme and add agent protocol"
  ```

---

## Task 15: Final Verification

- [ ] **Step 1: Check for remaining dark classes**

  Run:
  ```bash
  grep -rn "bg-\[#0F1628\]\|bg-\[#080B12\]\|bg-\[#0A0A0A\]\|bg-\[#131315\]\|bg-zinc-950\|bg-gray-900\|bg-slate-900\|Cormorant Garamond" frontend/src --include="*.jsx" --include="*.js"
  ```
  Expected output: empty (no matches).

- [ ] **Step 2: Check for remaining amber accent (#F59E0B)**

  Run:
  ```bash
  grep -rn "F59E0B\|amber-500\b" frontend/src --include="*.jsx" --include="*.js" | grep -v "text-amber-400\|bg-amber-500/15\|text-amber-600"
  ```
  Any matches should be reviewed and replaced with `text-primary` / `bg-primary`.

- [ ] **Step 3: Check for Cormorant Garamond in style props**

  Run:
  ```bash
  grep -rn "Cormorant" frontend/src --include="*.jsx" --include="*.js"
  ```
  Expected output: empty.

- [ ] **Step 4: Push branch**

  ```bash
  git push origin 1.7
  ```

---

## Summary

This plan converts all 20+ React pages from the old dark luxury theme to the Light, Minimal, Rounded UI defined in `design_guidelines.json`. The CSS variables and Tailwind config are already done. Each task is scoped to a page or logical group of pages and produces a clean, committable unit of work.
