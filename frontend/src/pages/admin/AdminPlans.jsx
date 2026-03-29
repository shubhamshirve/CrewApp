import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import {
  Plus, Pencil, Trash2, Users, Check, X, Loader2,
  CreditCard, MessageSquare, Globe, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, RefreshCw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LEGACY_OPTIONS = [
  { value: "", label: "None (standalone plan)" },
  { value: "base", label: "Base tier — migrates existing base users" },
  { value: "premium", label: "Premium tier — migrates existing premium users" },
];

const emptyForm = {
  name: "",
  price: "",
  description: "",
  features: { public_gig_enabled: false, whatsapp_enabled: false },
  legacy_tier: "",
  is_active: true,
  sort_order: 0,
};

function FeatureToggle({ label, icon: Icon, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      data-testid={`feature-toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all ${
        value
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={15} className={value ? "text-emerald-500" : "text-slate-400"} />
        <span className="text-sm font-display">{label}</span>
      </div>
      {value ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-slate-300" />}
    </button>
  );
}

function PlanDialog({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...emptyForm, ...initial, legacy_tier: initial.legacy_tier || "" } : { ...emptyForm });
  }, [open, initial]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setFeature = (key, val) => setForm(f => ({ ...f, features: { ...f.features, [key]: val } }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Plan name is required"); return; }
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) { toast.error("Enter a valid price"); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        price: Number(form.price),
        sort_order: Number(form.sort_order) || 0,
        legacy_tier: form.legacy_tier || null,
      });
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="font-display text-slate-900">
            {initial ? "Edit Plan" : "Create New Plan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-display text-slate-600">Plan Name *</Label>
              <Input
                data-testid="plan-name-input"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="e.g. Professional Plan"
                className="mt-1 border-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs font-display text-slate-600">Price (₹/month) *</Label>
              <Input
                data-testid="plan-price-input"
                type="number"
                value={form.price}
                onChange={e => set("price", e.target.value)}
                placeholder="69"
                className="mt-1 border-slate-200"
              />
            </div>
            <div>
              <Label className="text-xs font-display text-slate-600">Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => set("sort_order", e.target.value)}
                placeholder="0"
                className="mt-1 border-slate-200"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-display text-slate-600">Description</Label>
            <Input
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Brief description visible to users"
              className="mt-1 border-slate-200"
            />
          </div>

          {/* Feature toggles */}
          <div>
            <Label className="text-xs font-display text-slate-600 mb-2 block">Plan Features</Label>
            <div className="space-y-2">
              <FeatureToggle
                label="Public Gig Board Access"
                icon={Globe}
                value={form.features.public_gig_enabled}
                onChange={v => setFeature("public_gig_enabled", v)}
              />
              <FeatureToggle
                label="WhatsApp Notifications"
                icon={MessageSquare}
                value={form.features.whatsapp_enabled}
                onChange={v => setFeature("whatsapp_enabled", v)}
              />
            </div>
          </div>

          {/* Legacy tier */}
          <div>
            <Label className="text-xs font-display text-slate-600">Migrate Existing Users From</Label>
            <select
              data-testid="plan-legacy-select"
              value={form.legacy_tier}
              onChange={e => set("legacy_tier", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-blue-400"
            >
              {LEGACY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {form.legacy_tier && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} />
                All users on the "{form.legacy_tier}" plan will be auto-migrated to this plan.
              </p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-sm font-display text-slate-700">Plan Active</span>
            <button
              type="button"
              onClick={() => set("is_active", !form.is_active)}
              className="transition-colors"
            >
              {form.is_active
                ? <ToggleRight size={22} className="text-emerald-500" />
                : <ToggleLeft size={22} className="text-slate-300" />}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 font-display" disabled={saving}>
              Cancel
            </Button>
            <Button
              data-testid="plan-save-btn"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 font-display bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              {initial ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ plan, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Delete failed"); }
    finally { setDeleting(false); }
  };
  return (
    <Dialog open={!!plan} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white">
        <DialogHeader>
          <DialogTitle className="font-display text-slate-900">Delete Plan</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-sm text-slate-600">
            Delete <strong className="text-slate-900">{plan?.name}</strong>? This cannot be undone.
            {plan?.user_count > 0 && (
              <span className="block mt-1 text-red-500 text-xs">
                {plan.user_count} user(s) are on this plan. Deactivate it instead.
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 font-display" disabled={deleting}>Cancel</Button>
            <Button
              data-testid="plan-delete-confirm-btn"
              onClick={handleDelete}
              disabled={deleting || plan?.user_count > 0}
              className="flex-1 font-display bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPlans() {
  const { api } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [deletePlan, setDeletePlan] = useState(null);
  const [migrating, setMigrating] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/plans/admin/all");
      setPlans(res.data.plans || []);
    } catch { toast.error("Failed to load plans"); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    const res = await api.post("/plans/admin", data);
    toast.success(`Plan "${res.data.plan.name}" created!`);
    if (res.data.migrated_users > 0) toast.success(`${res.data.migrated_users} user(s) migrated automatically`);
    load();
  };

  const handleEdit = async (data) => {
    const res = await api.put(`/plans/admin/${editPlan.id}`, data);
    toast.success("Plan updated!");
    if (res.data.migrated_users > 0) toast.success(`${res.data.migrated_users} user(s) re-migrated`);
    load();
  };

  const handleDelete = async () => {
    await api.delete(`/plans/admin/${deletePlan.id}`);
    toast.success("Plan deleted");
    setDeletePlan(null);
    load();
  };

  const handleMigrate = async (plan) => {
    setMigrating(plan.id);
    try {
      const res = await api.post(`/plans/admin/${plan.id}/migrate`);
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Migration failed");
    } finally {
      setMigrating(null);
    }
  };

  const handleToggleActive = async (plan) => {
    try {
      await api.put(`/plans/admin/${plan.id}`, { is_active: !plan.is_active });
      toast.success(plan.is_active ? "Plan deactivated" : "Plan activated");
      load();
    } catch { toast.error("Failed to update"); }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-display">Subscription Plans</h1>
            <p className="text-slate-500 text-sm mt-0.5">Create and manage plans with feature access controls</p>
          </div>
          <Button
            data-testid="create-plan-btn"
            onClick={() => setShowCreate(true)}
            className="font-display bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Plus size={14} /> New Plan
          </Button>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center">
              <p className="text-2xl font-bold text-slate-900 font-display">{plans.length}</p>
              <p className="text-xs text-slate-500 font-display mt-0.5">Total Plans</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center">
              <p className="text-2xl font-bold text-emerald-600 font-display">{plans.filter(p => p.is_active).length}</p>
              <p className="text-xs text-slate-500 font-display mt-0.5">Active</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-center">
              <p className="text-2xl font-bold text-blue-600 font-display">{plans.reduce((s, p) => s + (p.user_count || 0), 0)}</p>
              <p className="text-xs text-slate-500 font-display mt-0.5">Subscribers</p>
            </div>
          </div>
        )}

        {/* Plans list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white">
            <CreditCard size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-display text-sm">No plans yet</p>
            <p className="text-slate-400 text-xs mt-1">Create your first subscription plan to get started</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 font-display bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Plus size={13} /> Create First Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <div
                key={plan.id}
                data-testid={`plan-row-${plan.id}`}
                className={`p-5 rounded-2xl border bg-white shadow-sm transition-all ${plan.is_active ? "border-slate-200" : "border-slate-100 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 font-display">{plan.name}</h3>
                      <span className="text-lg font-bold text-slate-900 font-display font-mono">₹{plan.price}</span>
                      <span className="text-xs text-slate-400">/month</span>
                      {plan.legacy_tier && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-display">
                          maps → {plan.legacy_tier}
                        </span>
                      )}
                      {!plan.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-display">Inactive</span>
                      )}
                    </div>
                    {plan.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{plan.description}</p>}

                    {/* Feature badges */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-display ${plan.features?.public_gig_enabled ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                        <Globe size={11} />
                        Gig Board {plan.features?.public_gig_enabled ? "ON" : "OFF"}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-display ${plan.features?.whatsapp_enabled ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                        <MessageSquare size={11} />
                        WhatsApp {plan.features?.whatsapp_enabled ? "ON" : "OFF"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 font-display">
                        <Users size={11} />
                        {plan.user_count || 0} subscribers
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {plan.legacy_tier && (
                      <button
                        data-testid={`migrate-plan-${plan.id}`}
                        onClick={() => handleMigrate(plan)}
                        disabled={migrating === plan.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display text-amber-600 border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-all disabled:opacity-50"
                        title="Re-run migration for this legacy tier"
                      >
                        {migrating === plan.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                        Migrate
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(plan)}
                      data-testid={`toggle-plan-active-${plan.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      {plan.is_active ? <ToggleRight size={13} className="text-emerald-500" /> : <ToggleLeft size={13} />}
                      {plan.is_active ? "Active" : "Inactive"}
                    </button>
                    <button
                      data-testid={`edit-plan-${plan.id}`}
                      onClick={() => setEditPlan(plan)}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      data-testid={`delete-plan-${plan.id}`}
                      onClick={() => setDeletePlan(plan)}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <PlanDialog open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} initial={null} />
      <PlanDialog open={!!editPlan} onClose={() => setEditPlan(null)} onSave={handleEdit} initial={editPlan} />
      <DeleteDialog plan={deletePlan} onClose={() => setDeletePlan(null)} onConfirm={handleDelete} />
    </AdminLayout>
  );
}
