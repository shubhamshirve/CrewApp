import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/contexts/PlatformContext";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import {
  MapPin, Calendar, IndianRupee, Users, Star, CheckCircle,
  Plus, Filter, ChevronDown, X, Briefcase, Clock, Eye,
  FileText, Search, SlidersHorizontal, Loader2, BadgeCheck,
  ArrowUpDown, Send, ChevronRight, Globe, CreditCard
} from "lucide-react";

const ROLES = [
  "Lead Photographer", "Second Shooter", "Videographer",
  "Drone Operator", "Photo Editor", "Video Editor",
  "Photo + Video", "Assistant"
];

const EVENT_TYPES = [
  "Haldi", "Mehendi", "Sangam", "Sangeet",
  "Baraat", "Wedding", "Reception", "Pre-Wedding Shoot",
  "Corporate", "Birthday", "Other"
];

const STATUS_COLORS = {
  open: "text-emerald-600 bg-emerald-50 border-emerald-200",
  partially_filled: "text-amber-600 bg-amber-50 border-amber-200",
  filled: "text-slate-500 bg-slate-100 border-slate-200",
  expired: "text-red-500 bg-red-50 border-red-200",
  cancelled: "text-red-500 bg-red-50 border-red-200",
};

const APP_STATUS_COLORS = {
  pending: "text-amber-600 bg-amber-50",
  accepted: "text-emerald-600 bg-emerald-50",
  rejected: "text-red-500 bg-red-50",
};

// ── Post Gig Modal ─────────────────────────────────────────────────────────────
function PostGigModal({ onClose, onSuccess, api, eventTypes: propEventTypes, roles: propRoles }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", event_type: "Wedding",
    date: "", city: "", location: "", venue_name: "",
    style_preference: "", expires_hours: 48,
  });
  const [roles, setRoles] = useState([
    { role: "Second Shooter", budget: 5000, slots: 1, verified_only: false, min_rating: null, gear_required: "" }
  ]);

  const rolesList = propRoles?.length ? propRoles : ROLES;
  const eventTypesList = propEventTypes?.length ? propEventTypes : EVENT_TYPES;

  const addRole = () => setRoles(r => [...r, { role: rolesList[0] || "Videographer", budget: 6000, slots: 1, verified_only: false, min_rating: null, gear_required: "" }]);
  const removeRole = (i) => setRoles(r => r.filter((_, idx) => idx !== i));
  const updateRole = (i, field, val) => setRoles(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.city || !form.location) {
      toast.error("Fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      await api.post("/public-gigs", { ...form, roles });
      toast.success("Gig posted to the board!");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to post gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 font-display">Post a Public Gig</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block">Gig Title *</label>
                <input
                  data-testid="post-gig-title"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="e.g. Weekend Wedding Coverage — Delhi"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Event Type *</label>
                <select
                  data-testid="post-gig-event-type"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                >
                  {eventTypesList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Date *</label>
                <input
                  data-testid="post-gig-date"
                  type="date"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">City *</label>
                <input
                  data-testid="post-gig-city"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="Mumbai"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Location / Area *</label>
                <input
                  data-testid="post-gig-location"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="Bandra West"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Venue Name</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="The Taj Mahal Palace"
                  value={form.venue_name}
                  onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Style Preference</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="Dark & Moody"
                  value={form.style_preference}
                  onChange={e => setForm(f => ({ ...f, style_preference: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 resize-none"
                  placeholder="Brief about the event, expectations, deliverables..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Listing Expires In</label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                  value={form.expires_hours}
                  onChange={e => setForm(f => ({ ...f, expires_hours: Number(e.target.value) }))}
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                data-testid="post-gig-next"
                onClick={() => {
                  if (!form.title || !form.date || !form.city || !form.location) {
                    toast.error("Fill all required fields");
                    return;
                  }
                  setStep(2);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: "#E05D26" }}
              >
                Next: Add Roles
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {roles.map((r, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-500">Role {i + 1}</span>
                    {roles.length > 1 && (
                      <button onClick={() => removeRole(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Role *</label>
                      <select
                        data-testid={`role-select-${i}`}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                        value={r.role}
                        onChange={e => updateRole(i, "role", e.target.value)}
                      >
                        {rolesList.map(rl => <option key={rl} value={rl}>{rl}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Budget (₹) *</label>
                      <input
                        data-testid={`role-budget-${i}`}
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                        value={r.budget}
                        onChange={e => updateRole(i, "budget", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Slots</label>
                      <input
                        type="number" min={1} max={5}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                        value={r.slots}
                        onChange={e => updateRole(i, "slots", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Min Rating</label>
                      <input
                        type="number" min={1} max={5} step={0.5}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                        placeholder="None"
                        value={r.min_rating || ""}
                        onChange={e => updateRole(i, "min_rating", e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Gear Required</label>
                      <input
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                        placeholder="e.g. Mirrorless body, 2 primes"
                        value={r.gear_required}
                        onChange={e => updateRole(i, "gear_required", e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox" id={`verified-${i}`}
                        checked={r.verified_only}
                        onChange={e => updateRole(i, "verified_only", e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <label htmlFor={`verified-${i}`} className="text-xs text-slate-500">Verified Only</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addRole}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:text-orange-500 hover:border-orange-300 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Add Another Role
            </button>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors"
              >
                Back
              </button>
              <button
                data-testid="post-gig-submit"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-black flex items-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: "#F59E0B" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Post to Board
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Apply Modal ────────────────────────────────────────────────────────────────
function ApplyModal({ gig, onClose, onSuccess, api }) {
  const openRoles = (gig.roles || []).filter(r => (r.filled_count || 0) < (r.slots || 1));
  const [selectedRole, setSelectedRole] = useState(openRoles[0]?.id || "");
  const [offerPrice, setOfferPrice] = useState(openRoles[0]?.budget || "");
  const [coverNote, setCoverNote] = useState("");
  const [loading, setLoading] = useState(false);

  const roleSpec = openRoles.find(r => r.id === selectedRole);

  const handleApply = async () => {
    if (!selectedRole || !offerPrice) { toast.error("Select a role and enter your offer"); return; }
    setLoading(true);
    try {
      await api.post(`/public-gigs/${gig.id}/apply`, {
        role_id: selectedRole,
        offer_price: Number(offerPrice),
        cover_note: coverNote,
      });
      toast.success("Application submitted!");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to apply");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 font-display">Apply for Gig</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">{gig.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Select Role *</label>
            <select
              data-testid="apply-role-select"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
              value={selectedRole}
              onChange={e => {
                setSelectedRole(e.target.value);
                const r = openRoles.find(x => x.id === e.target.value);
                if (r) setOfferPrice(r.budget);
              }}
            >
              {openRoles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.role} — ₹{r.budget.toLocaleString()} ({r.slots - (r.filled_count || 0)} slot{r.slots - (r.filled_count || 0) !== 1 ? "s" : ""} left)
                </option>
              ))}
            </select>
          </div>

          {roleSpec && (
            <div className="flex flex-wrap gap-2 text-xs">
              {roleSpec.verified_only && (
                <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                  <BadgeCheck size={10} /> Verified Only
                </span>
              )}
              {roleSpec.min_rating && (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <Star size={10} /> Min {roleSpec.min_rating}★
                </span>
              )}
              {roleSpec.gear_required && (
                <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  {roleSpec.gear_required}
                </span>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Your Offer Price (₹) *</label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="apply-offer-price"
                type="number"
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
              />
            </div>
            {roleSpec && (
              <p className="text-xs text-slate-400 mt-1">Lead's budget: ₹{roleSpec.budget.toLocaleString()}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Cover Note</label>
            <textarea
              data-testid="apply-cover-note"
              rows={3}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 resize-none"
              placeholder="Briefly introduce yourself and why you're a great fit..."
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
            />
          </div>

          <button
            data-testid="apply-submit-btn"
            onClick={handleApply}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-black flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "#F59E0B" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Applications Modal ─────────────────────────────────────────────────
function ManageModal({ gig, onClose, onUpdate, api }) {
  const [applications, setApplications] = useState(gig.applications || []);
  const [loading, setLoading] = useState({});

  const handle = async (appId, action) => {
    setLoading(l => ({ ...l, [appId]: true }));
    try {
      await api.put(`/public-gigs/${gig.id}/applications/${appId}/${action}`);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: action === "accept" ? "accepted" : "rejected" } : a));
      toast.success(action === "accept" ? "Applicant accepted!" : "Application rejected");
      onUpdate();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action failed");
    } finally {
      setLoading(l => ({ ...l, [appId]: false }));
    }
  };

  const pending = applications.filter(a => a.status === "pending");
  const processed = applications.filter(a => a.status !== "pending");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 font-display">Applications</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[320px]">{gig.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {applications.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No applications yet</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-amber-600 mb-3 uppercase tracking-wide">Pending Review ({pending.length})</p>
            <div className="space-y-3">
              {pending.map(app => (
                <div key={app.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{app.applicant?.full_name || app.applicant_name}</p>
                      <p className="text-xs text-slate-500">{app.role_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-500">₹{app.offer_price?.toLocaleString()}</p>
                      {app.applicant?.avg_rating > 0 && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                          <Star size={10} fill="currentColor" className="text-amber-400" />
                          {app.applicant.avg_rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  {app.cover_note && (
                    <p className="text-xs text-slate-500 italic mb-3 border-l-2 border-orange-300 pl-2">"{app.cover_note}"</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      data-testid={`accept-app-${app.id}`}
                      onClick={() => handle(app.id, "accept")}
                      disabled={loading[app.id]}
                      className="flex-1 py-2 rounded-lg text-xs font-medium text-white flex items-center justify-center gap-1 disabled:opacity-60 transition-opacity"
                      style={{ background: "#E05D26" }}
                    >
                      {loading[app.id] ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Accept
                    </button>
                    <button
                      data-testid={`reject-app-${app.id}`}
                      onClick={() => handle(app.id, "reject")}
                      disabled={loading[app.id]}
                      className="flex-1 py-2 rounded-lg text-xs font-medium text-slate-400 border border-slate-200 hover:border-red-300 hover:text-red-500 flex items-center justify-center gap-1 disabled:opacity-60 transition-all"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {processed.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Processed ({processed.length})</p>
            <div className="space-y-2">
              {processed.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-900">{app.applicant?.full_name || app.applicant_name}</p>
                    <p className="text-xs text-slate-400">{app.role_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">₹{app.offer_price?.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${APP_STATUS_COLORS[app.status]}`}>
                      {app.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gig Card (Browse) ─────────────────────────────────────────────────────────
function GigCard({ gig, onApply }) {
  const openRoles = (gig.roles || []).filter(r => (r.filled_count || 0) < (r.slots || 1));

  return (
    <div
      data-testid="gig-board-card"
      className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 hover:border-orange-300 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[gig.status] || STATUS_COLORS.open}`}>
              {gig.status === "partially_filled" ? "Partially Filled" : gig.status}
            </span>
            {gig.match_score > 60 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                {gig.match_score}% match
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 text-base font-display leading-tight group-hover:text-orange-500 transition-colors">
            {gig.title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{gig.event_type} • {gig.lead_name}</p>
        </div>
        {gig.has_applied && (
          <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full flex-shrink-0 ml-3">
            <CheckCircle size={10} /> Applied
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Calendar size={12} /> {gig.date}</span>
        <span className="flex items-center gap-1"><MapPin size={12} /> {gig.city}</span>
        <span className="flex items-center gap-1"><Eye size={12} /> {gig.view_count} views</span>
        <span className="flex items-center gap-1"><Users size={12} /> {gig.application_count} applied</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(gig.roles || []).map(r => (
          <div key={r.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50">
            <Briefcase size={10} className="text-orange-500" />
            <span className="text-slate-700">{r.role}</span>
            <span className="text-slate-400">₹{r.budget?.toLocaleString()}</span>
            {r.filled_count >= r.slots && <span className="text-red-500 ml-1">Full</span>}
          </div>
        ))}
      </div>

      {gig.description && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{gig.description}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {gig.lead_verified && <BadgeCheck size={12} className="text-orange-500" />}
          {gig.lead_rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star size={10} fill="currentColor" className="text-amber-400" />
              {gig.lead_rating?.toFixed(1)}
            </span>
          )}
          <Clock size={10} />
          <span>Expires {new Date(gig.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        </div>
        {!gig.has_applied && openRoles.length > 0 && (
          <button
            data-testid="apply-gig-btn"
            onClick={() => onApply(gig)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#F97316" }}
          >
            Apply Now
          </button>
        )}
      </div>
    </div>
  );
}

// ── My Post Card ──────────────────────────────────────────────────────────────
function MyPostCard({ gig, onManage, onCancel, api }) {
  return (
    <div
      data-testid="my-post-card"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[gig.status] || STATUS_COLORS.open}`}>
            {gig.status === "partially_filled" ? "Partially Filled" : gig.status}
          </span>
          <h3 className="font-semibold text-slate-900 mt-1.5 font-display">{gig.title}</h3>
          <p className="text-xs text-slate-400">{gig.event_type} • {gig.date} • {gig.city}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p className="text-lg font-bold text-slate-900">{gig.application_count || 0}</p>
          <p>applications</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(gig.roles || []).map(r => (
          <span key={r.id} className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
            {r.role} ({r.filled_count || 0}/{r.slots}) — ₹{r.budget?.toLocaleString()}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          data-testid="manage-applications-btn"
          onClick={() => onManage(gig)}
          className="flex-1 py-2 rounded-lg text-xs font-medium border border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
        >
          <Users size={12} /> Review Applications
        </button>
        {gig.status !== "filled" && gig.status !== "cancelled" && (
          <button
            data-testid="cancel-gig-btn"
            onClick={() => onCancel(gig.id)}
            className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GigBoard() {
  const { api, user } = useAuth();
  const { eventTypes: platformEventTypes, roles: platformRoles } = usePlatform();
  const [tab, setTab] = useState("browse");
  const [gigs, setGigs] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [applyModal, setApplyModal] = useState(null);
  const [manageModal, setManageModal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ role: "", city: "", event_type: "", budget_min: "", budget_max: "" });

  // Use platform context instead of per-page API calls
  const dynamicRoles = platformRoles;
  const dynamicEventTypes = platformEventTypes;

  // Check plan access — admins always have full access
  const hasAccess = user?.is_admin === true || user?.active_plan_features?.public_gig_enabled === true;

  const fetchBrowse = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.role) params.role = filters.role;
      if (filters.city) params.city = filters.city;
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.budget_min) params.budget_min = Number(filters.budget_min);
      if (filters.budget_max) params.budget_max = Number(filters.budget_max);
      const r = await api.get("/public-gigs", { params });
      setGigs(r.data);
      setAccessDenied(false);
    } catch (e) {
      if (e.response?.status === 403) { setAccessDenied(true); }
      else { toast.error("Failed to load gig board"); }
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  const fetchMyPosts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/public-gigs/my-posts");
      setMyPosts(r.data);
    } catch {
      toast.error("Failed to load your posts");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchMyApps = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/public-gigs/applications/my");
      setMyApps(r.data);
    } catch {
      toast.error("Failed to load your applications");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (tab === "browse") fetchBrowse();
    else if (tab === "my-posts") fetchMyPosts();
    else fetchMyApps();
  }, [tab]);

  const handleManage = async (gig) => {
    try {
      const r = await api.get(`/public-gigs/${gig.id}`);
      setManageModal(r.data);
    } catch {
      toast.error("Failed to load applications");
    }
  };

  const handleCancel = async (gigId) => {
    if (!window.confirm("Cancel this gig listing?")) return;
    try {
      await api.put(`/public-gigs/${gigId}/cancel`);
      toast.success("Gig cancelled");
      fetchMyPosts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to cancel");
    }
  };

  const TABS = [
    { id: "browse", label: "Browse Gigs", count: gigs.length },
    { id: "my-posts", label: "My Posts", count: myPosts.length },
    { id: "my-applications", label: "My Applications", count: myApps.length },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 font-display">Gig Board</h1>
            <p className="text-slate-500 text-sm mt-1">Open gigs posted by leads — browse and bid</p>
          </div>
          <button
            data-testid="post-gig-btn"
            onClick={() => !hasAccess ? toast.error("Upgrade your plan to post gigs") : setShowPostModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#F97316" }}
          >
            <Plus size={16} /> Post Gig
          </button>
        </div>

        {/* Access upgrade wall */}
        {(!hasAccess || accessDenied) && (
          <div data-testid="gig-board-upgrade-wall" className="py-14 rounded-2xl border border-dashed border-orange-300 bg-orange-50 text-center px-6">
            <Globe size={36} className="mx-auto text-orange-400 mb-3" />
            <h2 className="text-lg font-semibold text-slate-900 font-display">Gig Board Access Required</h2>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
              Access to browse and post public gigs requires a subscription plan with the Gig Board feature enabled.
            </p>
            <a
              href="/wallet"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ background: "#F97316" }}
            >
              <CreditCard size={14} /> View Plans & Upgrade
            </a>
          </div>
        )}

        {/* Tabs */}
        {hasAccess && !accessDenied && <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-slate-100">
          {TABS.map(t => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                tab === t.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>}

        {/* Browse filters */}
        {hasAccess && !accessDenied && tab === "browse" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="filter-city"
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400"
                  placeholder="Filter by city..."
                  value={filters.city}
                  onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <button
                data-testid="toggle-filters-btn"
                onClick={() => setShowFilters(s => !s)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border transition-all ${
                  showFilters ? "border-orange-300 text-orange-500 bg-orange-50" : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal size={14} /> Filters
              </button>
              <button
                data-testid="apply-filters-btn"
                onClick={fetchBrowse}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: "#F97316" }}
              >
                Search
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Role</label>
                  <select
                    data-testid="filter-role"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-orange-400"
                    value={filters.role}
                    onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="">All Roles</option>
                    {dynamicRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Event Type</label>
                  <select
                    data-testid="filter-event-type"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-orange-400"
                    value={filters.event_type}
                    onChange={e => setFilters(f => ({ ...f, event_type: e.target.value }))}
                  >
                    <option value="">All Events</option>
                    {dynamicEventTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Min Budget (₹)</label>
                  <input
                    data-testid="filter-budget-min"
                    type="number"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-orange-400"
                    placeholder="0"
                    value={filters.budget_min}
                    onChange={e => setFilters(f => ({ ...f, budget_min: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Max Budget (₹)</label>
                  <input
                    data-testid="filter-budget-max"
                    type="number"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-orange-400"
                    placeholder="Any"
                    value={filters.budget_max}
                    onChange={e => setFilters(f => ({ ...f, budget_max: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {hasAccess && !accessDenied && loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-amber-500" />
          </div>
        ) : hasAccess && !accessDenied ? (
          <>
            {/* Browse Tab */}
            {tab === "browse" && (
              <div className="space-y-4">
                {gigs.length === 0 ? (
                  <div className="text-center py-20">
                    <Briefcase size={40} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-sm">No open gigs found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting filters or check back later</p>
                  </div>
                ) : (
                  gigs.map(g => (
                    <GigCard key={g.id} gig={g} onApply={setApplyModal} />
                  ))
                )}
              </div>
            )}

            {/* My Posts Tab */}
            {tab === "my-posts" && (
              <div className="space-y-4">
                {myPosts.length === 0 ? (
                  <div className="text-center py-20">
                    <FileText size={40} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-sm">No gigs posted yet</p>
                    <button
                      onClick={() => setShowPostModal(true)}
                      className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
                      style={{ background: "#F97316" }}
                    >
                      Post Your First Gig
                    </button>
                  </div>
                ) : (
                  myPosts.map(g => (
                    <MyPostCard
                      key={g.id}
                      gig={g}
                      onManage={handleManage}
                      onCancel={handleCancel}
                      api={api}
                    />
                  ))
                )}
              </div>
            )}

            {/* My Applications Tab */}
            {tab === "my-applications" && (
              <div className="space-y-3">
                {myApps.length === 0 ? (
                  <div className="text-center py-20">
                    <Send size={40} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-sm">No applications submitted yet</p>
                    <button
                      onClick={() => setTab("browse")}
                      className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
                      style={{ background: "#F97316" }}
                    >
                      Browse Gigs
                    </button>
                  </div>
                ) : (
                  myApps.map(a => (
                    <div
                      key={a.id}
                      data-testid="my-application-card"
                      className="flex items-start justify-between p-4 rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 font-display">{a.gig?.title || a.gig_title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.role_name}</p>
                        {a.cover_note && (
                          <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">"{a.cover_note}"</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          {a.gig && (
                            <>
                              <span className="flex items-center gap-1"><MapPin size={10} /> {a.gig.city}</span>
                              <span className="flex items-center gap-1"><Calendar size={10} /> {a.gig.date}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-sm font-semibold text-orange-500">₹{a.offer_price?.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${APP_STATUS_COLORS[a.status]}`}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Modals */}
      {showPostModal && (
        <PostGigModal
          api={api}
          onClose={() => setShowPostModal(false)}
          onSuccess={() => { if (tab === "my-posts") fetchMyPosts(); }}
          eventTypes={dynamicEventTypes}
          roles={dynamicRoles}
        />
      )}
      {applyModal && (
        <ApplyModal
          gig={applyModal}
          api={api}
          onClose={() => setApplyModal(null)}
          onSuccess={fetchBrowse}
        />
      )}
      {manageModal && (
        <ManageModal
          gig={manageModal}
          api={api}
          onClose={() => setManageModal(null)}
          onUpdate={() => { fetchMyPosts(); handleManage(manageModal); }}
        />
      )}
    </Layout>
  );
}
