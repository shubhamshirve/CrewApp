import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings, DollarSign, Tag, Briefcase,
  Plus, Trash2, Save, RefreshCw, Key, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";

const inputClass = "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-1 focus:ring-blue-400/20 transition-all";

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

  // API Keys state
  const [apiKeys, setApiKeys] = useState({});
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [showValues, setShowValues] = useState({});
  const [savingKey, setSavingKey] = useState({});

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

  // ── API Keys ───────────────────────────────────────────────────────────────

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const res = await api.get("/platform/api-keys");
      setApiKeys(res.data);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setApiKeysLoading(false);
    }
  };

  const saveApiKey = async (group, field, value) => {
    const keyId = `${group}.${field}`;
    setSavingKey(s => ({ ...s, [keyId]: true }));
    try {
      await api.put("/platform/api-keys", { group, field, value });
      toast.success("Key saved!");
      // Refresh to get new masked value
      await loadApiKeys();
      setEditValues(v => { const n = { ...v }; delete n[keyId]; return n; });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save key");
    } finally {
      setSavingKey(s => ({ ...s, [keyId]: false }));
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const SectionCard = ({ children, title, icon: Icon }) => (
    <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon size={15} className="text-blue-500" />}
          <h3 className="text-sm font-semibold text-slate-900 font-display">{title}</h3>
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
        className="text-blue-400 hover:text-red-500 transition-colors ml-1"
        title={`Remove "${label}"`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );

  const GROUP_COLORS = {
    razorpay: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
    resend: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", text: "text-blue-700" },
    whatsapp: { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700" },
    google_calendar: { bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", text: "text-orange-700" },
    ai: { bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500", text: "text-violet-700" },
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
            <Settings size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-display">Platform Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage pricing, event types, roles, and integrations</p>
          </div>
        </div>

        <Tabs defaultValue="pricing">
          <TabsList className="bg-slate-100 border border-slate-200">
            <TabsTrigger value="pricing" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-display text-xs gap-1.5 text-slate-500">
              <DollarSign size={12} /> Pricing
            </TabsTrigger>
            <TabsTrigger value="event-types" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-display text-xs gap-1.5 text-slate-500">
              <Tag size={12} /> Event Types
            </TabsTrigger>
            <TabsTrigger value="roles" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-display text-xs gap-1.5 text-slate-500">
              <Briefcase size={12} /> Roles
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-display text-xs gap-1.5 text-slate-500" onClick={() => { if (Object.keys(apiKeys).length === 0) loadApiKeys(); }}>
              <Key size={12} /> API Keys
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
                      <label className="text-xs text-slate-500 font-display mb-1 block">Base Plan Name</label>
                      <input className={inputClass} value={pricing.base_plan_name} onChange={e => setPricing(p => ({ ...p, base_plan_name: e.target.value }))} placeholder="Base Plan" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-display mb-1 block">Base Plan Price (₹/month)</label>
                      <input type="number" min="1" className={inputClass} value={pricing.base_plan_price} onChange={e => setPricing(p => ({ ...p, base_plan_price: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-display mb-1 block">Premium Plan Name</label>
                      <input className={inputClass} value={pricing.premium_plan_name} onChange={e => setPricing(p => ({ ...p, premium_plan_name: e.target.value }))} placeholder="Premium Plan" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-display mb-1 block">Premium Plan Price (₹/month)</label>
                      <input type="number" min="1" className={inputClass} value={pricing.premium_plan_price} onChange={e => setPricing(p => ({ ...p, premium_plan_price: e.target.value }))} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Referral Program" icon={DollarSign}>
                  <div className="max-w-xs">
                    <label className="text-xs text-slate-500 font-display mb-1 block">Referral Reward Amount (₹)</label>
                    <input type="number" min="0" className={inputClass} value={pricing.referral_reward} onChange={e => setPricing(p => ({ ...p, referral_reward: e.target.value }))} />
                    <p className="text-xs text-slate-400 mt-1.5 font-display">
                      Credited to referrer's wallet when their referral makes first subscription
                    </p>
                  </div>
                </SectionCard>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-slate-400">
                    {pricing.updated_at ? `Last updated: ${new Date(pricing.updated_at).toLocaleString("en-IN")}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadPricing} className="border-slate-200 text-slate-500 text-xs gap-1">
                      <RefreshCw size={12} /> Refresh
                    </Button>
                    <Button size="sm" onClick={savePricing} disabled={pricingSaving} className="text-xs gap-1 text-white" style={{ background: "#1D4ED8" }}>
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
                <Tag size={15} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-900 font-display">Wedding Event Types</h3>
                <span className="ml-auto text-xs text-slate-400 font-display">{eventTypes.length} types</span>
              </div>
              <div className="flex gap-2 mb-5">
                <input className={`${inputClass} flex-1`} placeholder="e.g. Sagai, Tilak, Grihapravesh…" value={newEventType} onChange={e => setNewEventType(e.target.value)} onKeyDown={e => e.key === "Enter" && addEventType()} />
                <Button size="sm" onClick={addEventType} disabled={etAdding} className="gap-1 flex-shrink-0 text-xs text-white" style={{ background: "#1D4ED8" }}>
                  {etAdding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />} Add
                </Button>
              </div>
              {etLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map(name => <TagChip key={name} label={name} onRemove={removeEventType} />)}
                  {eventTypes.length === 0 && <p className="text-xs text-slate-400 py-4 font-display">No event types defined yet.</p>}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-4 font-display">These appear in gig creation forms and the Gig Board filters.</p>
            </SectionCard>
          </TabsContent>

          {/* ── Roles Tab ── */}
          <TabsContent value="roles" className="mt-4">
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={15} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-900 font-display">Professional Role Categories</h3>
                <span className="ml-auto text-xs text-slate-400 font-display">{roles.length} roles</span>
              </div>
              <div className="flex gap-2 mb-5">
                <input className={`${inputClass} flex-1`} placeholder="e.g. Photo Booth Operator, Sound Engineer…" value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => e.key === "Enter" && addRole()} />
                <Button size="sm" onClick={addRole} disabled={roleAdding} className="gap-1 flex-shrink-0 text-xs text-white" style={{ background: "#1D4ED8" }}>
                  {roleAdding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />} Add
                </Button>
              </div>
              {rolesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map(name => <TagChip key={name} label={name} onRemove={removeRole} />)}
                  {roles.length === 0 && <p className="text-xs text-slate-400 py-4 font-display">No roles defined yet.</p>}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-4 font-display">These appear in user onboarding, profile settings, and search filters.</p>
            </SectionCard>
          </TabsContent>

          {/* ── API Keys Tab ── */}
          <TabsContent value="api-keys" className="mt-4 space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
              <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                API keys are encrypted and stored securely. Values are masked after saving. Activate integrations by providing their credentials below.
              </p>
            </div>

            {apiKeysLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            ) : Object.keys(apiKeys).length === 0 ? (
              <div className="text-center py-12">
                <Key size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading integration settings…</p>
                <Button size="sm" onClick={loadApiKeys} className="mt-3 text-xs text-white" style={{ background: "#1D4ED8" }}>
                  Load API Keys
                </Button>
              </div>
            ) : (
              Object.entries(apiKeys).map(([groupKey, group]) => {
                const colors = GROUP_COLORS[groupKey] || { bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400", text: "text-slate-700" };
                return (
                  <div key={groupKey} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Group header */}
                    <div className={`px-5 py-3.5 flex items-center justify-between border-b border-slate-100 ${colors.bg}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 font-display">{group.label}</h3>
                          <p className="text-xs text-slate-500">{group.description}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-display ${group.is_active ? `${colors.bg} ${colors.text} border ${colors.border}` : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                        {group.is_active ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {group.is_active ? "Active" : "Not configured"}
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="p-5 space-y-3">
                      {Object.entries(group.fields).map(([fieldKey, field]) => {
                        const keyId = `${groupKey}.${fieldKey}`;
                        const isEditing = editValues[keyId] !== undefined;
                        const currentVal = isEditing ? editValues[keyId] : (field.value || "");
                        const isVisible = showValues[keyId];

                        return (
                          <div key={fieldKey} data-testid={`api-key-field-${keyId}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <label className="text-xs font-medium text-slate-700 font-display">{field.label}</label>
                              {field.is_configured && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-display">Saved</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input
                                  type={field.secret && !isVisible ? "password" : "text"}
                                  data-testid={`api-key-input-${keyId}`}
                                  className={`${inputClass} pr-9`}
                                  value={currentVal}
                                  placeholder={field.is_configured ? "••••••••" : `Enter ${field.label}…`}
                                  onChange={e => setEditValues(v => ({ ...v, [keyId]: e.target.value }))}
                                  readOnly={!isEditing && field.is_configured}
                                />
                                {field.secret && (
                                  <button
                                    type="button"
                                    onClick={() => setShowValues(v => ({ ...v, [keyId]: !v[keyId] }))}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    data-testid={`save-key-btn-${keyId}`}
                                    onClick={() => saveApiKey(groupKey, fieldKey, editValues[keyId])}
                                    disabled={savingKey[keyId]}
                                    className="text-xs text-white gap-1"
                                    style={{ background: "#1D4ED8" }}
                                  >
                                    {savingKey[keyId] ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditValues(v => { const n = { ...v }; delete n[keyId]; return n; })}
                                    className="text-xs border-slate-200 text-slate-500"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`edit-key-btn-${keyId}`}
                                  onClick={() => setEditValues(v => ({ ...v, [keyId]: "" }))}
                                  className="text-xs border-slate-200 text-slate-600"
                                >
                                  {field.is_configured ? "Update" : "Set"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
