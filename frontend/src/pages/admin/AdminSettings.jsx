import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings, DollarSign, Tag, Briefcase,
  Plus, Trash2, Save, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const inputClass = "bg-slate-50 border border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/60 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-1 focus:ring-blue-500/30 transition-all";

export default function AdminSettings() {
  const { api } = useAuth();

  // Pricing state
  const [pricing, setPricing] = useState({
    referral_reward: 50,
    base_plan_price: 69,
    premium_plan_price: 99,
    base_plan_name: "Base Plan",
    premium_plan_name: "Premium Plan",
  });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);

  // Event types state
  const [eventTypes, setEventTypes] = useState([]);
  const [etLoading, setEtLoading] = useState(false);
  const [newEventType, setNewEventType] = useState("");
  const [etAdding, setEtAdding] = useState(false);

  // Roles state
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleAdding, setRoleAdding] = useState(false);

  useEffect(() => {
    loadPricing();
    loadEventTypes();
    loadRoles();
  }, []);

  // ── Pricing ────────────────────────────────────────────────────────────────

  const loadPricing = async () => {
    setPricingLoading(true);
    try {
      const res = await api.get("/platform/settings");
      setPricing(res.data);
    } catch {
      toast.error("Failed to load pricing settings");
    } finally {
      setPricingLoading(false);
    }
  };

  const savePricing = async () => {
    setPricingSaving(true);
    try {
      const res = await api.put("/platform/settings", {
        referral_reward: parseInt(pricing.referral_reward) || 0,
        base_plan_price: parseInt(pricing.base_plan_price) || 1,
        premium_plan_price: parseInt(pricing.premium_plan_price) || 1,
        base_plan_name: pricing.base_plan_name,
        premium_plan_name: pricing.premium_plan_name,
      });
      setPricing(res.data);
      toast.success("Pricing rules saved!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save pricing");
    } finally {
      setPricingSaving(false);
    }
  };

  // ── Event Types ────────────────────────────────────────────────────────────

  const loadEventTypes = async () => {
    setEtLoading(true);
    try {
      const res = await api.get("/platform/event-types");
      setEventTypes(res.data.event_types || []);
    } catch {
      toast.error("Failed to load event types");
    } finally {
      setEtLoading(false);
    }
  };

  const addEventType = async () => {
    const name = newEventType.trim();
    if (!name) { toast.error("Enter an event type name"); return; }
    setEtAdding(true);
    try {
      const res = await api.post("/platform/event-types", { name });
      setEventTypes(res.data.event_types);
      setNewEventType("");
      toast.success(`"${name}" added`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add");
    } finally {
      setEtAdding(false);
    }
  };

  const removeEventType = async (name) => {
    try {
      const res = await api.delete(`/platform/event-types/${encodeURIComponent(name)}`);
      setEventTypes(res.data.event_types);
      toast.success(`"${name}" removed`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to remove");
    }
  };

  // ── Roles ──────────────────────────────────────────────────────────────────

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const res = await api.get("/platform/roles");
      setRoles(res.data.roles || []);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) { toast.error("Enter a role name"); return; }
    setRoleAdding(true);
    try {
      const res = await api.post("/platform/roles", { name });
      setRoles(res.data.roles);
      setNewRole("");
      toast.success(`"${name}" added`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add");
    } finally {
      setRoleAdding(false);
    }
  };

  const removeRole = async (name) => {
    try {
      const res = await api.delete(`/platform/roles/${encodeURIComponent(name)}`);
      setRoles(res.data.roles);
      toast.success(`"${name}" removed`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to remove");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const SectionCard = ({ children, title, icon: Icon }) => (
    <div className="rounded-xl border border-border bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon size={15} className="text-blue-500" />}
          <h3 className="text-sm font-semibold text-foreground font-display">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );

  const TagChip = ({ label, onRemove }) => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-display bg-blue-50 border border-blue-200 text-blue-700">
      <span>{label}</span>
      <button
        onClick={() => onRemove(label)}
        className="text-blue-400/60 hover:text-red-400 transition-colors ml-1"
        title={`Remove "${label}"`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-semibold text-foreground font-display">Platform Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage pricing, event types, and professional roles</p>
          </div>
        </div>

        <Tabs defaultValue="pricing">
          <TabsList className="border border-border bg-slate-100">
            <TabsTrigger
              value="pricing"
              className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs gap-1.5"
            >
              <DollarSign size={12} /> Pricing
            </TabsTrigger>
            <TabsTrigger
              value="event-types"
              className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs gap-1.5"
            >
              <Tag size={12} /> Event Types
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs gap-1.5"
            >
              <Briefcase size={12} /> Role Categories
            </TabsTrigger>
          </TabsList>

          {/* ── Pricing Tab ── */}
          <TabsContent value="pricing" className="mt-4 space-y-4">
            {pricingLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <SectionCard title="Subscription Plans" icon={DollarSign}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground font-display mb-1 block">Base Plan Name</label>
                      <input
                        className={inputClass}
                        value={pricing.base_plan_name}
                        onChange={e => setPricing(p => ({ ...p, base_plan_name: e.target.value }))}
                        placeholder="Base Plan"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-display mb-1 block">Base Plan Price (₹/month)</label>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={pricing.base_plan_price}
                        onChange={e => setPricing(p => ({ ...p, base_plan_price: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-display mb-1 block">Premium Plan Name</label>
                      <input
                        className={inputClass}
                        value={pricing.premium_plan_name}
                        onChange={e => setPricing(p => ({ ...p, premium_plan_name: e.target.value }))}
                        placeholder="Premium Plan"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-display mb-1 block">Premium Plan Price (₹/month)</label>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={pricing.premium_plan_price}
                        onChange={e => setPricing(p => ({ ...p, premium_plan_price: e.target.value }))}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Referral Program" icon={DollarSign}>
                  <div className="max-w-xs">
                    <label className="text-xs text-zinc-400 font-display mb-1 block">
                      Referral Reward Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={pricing.referral_reward}
                      onChange={e => setPricing(p => ({ ...p, referral_reward: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5 font-display">
                      Credited to referrer's wallet when their referral makes first subscription
                    </p>
                  </div>
                </SectionCard>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    {pricing.updated_at
                      ? `Last updated: ${new Date(pricing.updated_at).toLocaleString("en-IN")}`
                      : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadPricing}
                      className="border-border text-slate-600 text-xs gap-1"
                    >
                      <RefreshCw size={12} /> Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={savePricing}
                      disabled={pricingSaving}
                      className="text-xs gap-1"
                      style={{ background: "#1D4ED8", color: "#fff" }}
                    >
                      {pricingSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                      {pricingSaving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Event Types Tab ── */}
          <TabsContent value="event-types" className="mt-4">
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <Tag size={15} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground font-display">Wedding Event Types</h3>
                <span className="ml-auto text-xs text-muted-foreground font-display">{eventTypes.length} types</span>
              </div>

              {/* Add new */}
              <div className="flex gap-2 mb-5">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="e.g. Sagai, Tilak, Grihapravesh…"
                  value={newEventType}
                  onChange={e => setNewEventType(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEventType()}
                />
                <Button
                  size="sm"
                  onClick={addEventType}
                  disabled={etAdding}
                  className="gap-1 flex-shrink-0 text-xs"
                  style={{ background: "#1D4ED8", color: "#fff" }}
                >
                  {etAdding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </Button>
              </div>

              {etLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map(name => (
                    <TagChip key={name} label={name} onRemove={removeEventType} />
                  ))}
                  {eventTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 font-display">No event types defined yet.</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-4 font-display">
                These appear in gig creation forms and the Gig Board filters.
              </p>
            </SectionCard>
          </TabsContent>

          {/* ── Roles Tab ── */}
          <TabsContent value="roles" className="mt-4">
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={15} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground font-display">Professional Role Categories</h3>
                <span className="ml-auto text-xs text-muted-foreground font-display">{roles.length} roles</span>
              </div>

              {/* Add new */}
              <div className="flex gap-2 mb-5">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="e.g. Photo Booth Operator, Sound Engineer…"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addRole()}
                />
                <Button
                  size="sm"
                  onClick={addRole}
                  disabled={roleAdding}
                  className="gap-1 flex-shrink-0 text-xs"
                  style={{ background: "#1D4ED8", color: "#fff" }}
                >
                  {roleAdding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </Button>
              </div>

              {rolesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map(name => (
                    <TagChip key={name} label={name} onRemove={removeRole} />
                  ))}
                  {roles.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 font-display">No roles defined yet.</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-4 font-display">
                These appear in user onboarding, profile settings, and search filters.
              </p>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
