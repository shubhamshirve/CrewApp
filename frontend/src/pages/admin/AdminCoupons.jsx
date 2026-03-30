import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, Calendar, Users, Percent, IndianRupee, Copy } from "lucide-react";

export default function AdminCoupons() {
  const { api } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    max_redemptions: "",
    per_user_limit: "1",
    valid_until: "",
    applicable_plan_id: "",
  });

  useEffect(() => {
    load();
    api.get("/plans").then(r => setPlans(r.data?.filter(p => p.is_active) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/coupons");
      setCoupons(r.data || []);
    } catch { toast.error("Failed to load coupons"); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.code || !form.discount_value || !form.max_redemptions) {
      return toast.error("Please fill all required fields");
    }
    setSaving(true);
    try {
      await api.post("/coupons", {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        max_redemptions: parseInt(form.max_redemptions),
        per_user_limit: parseInt(form.per_user_limit) || 1,
        valid_until: form.valid_until || null,
        applicable_plan_id: form.applicable_plan_id || null,
      });
      toast.success("Coupon created!");
      setShowCreate(false);
      setForm({ code: "", discount_type: "percentage", discount_value: "", max_redemptions: "", per_user_limit: "1", valid_until: "", applicable_plan_id: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create coupon");
    } finally { setSaving(false); }
  }

  async function handleDelete(code) {
    if (!window.confirm(`Delete coupon ${code}?`)) return;
    try {
      await api.delete(`/coupons/${code}`);
      toast.success("Coupon deleted");
      load();
    } catch { toast.error("Failed to delete"); }
  }

  async function handleToggle(code) {
    try {
      const r = await api.patch(`/coupons/${code}/toggle`);
      setCoupons(prev => prev.map(c => c.id === code ? { ...c, is_active: r.data.is_active } : c));
    } catch { toast.error("Failed to toggle coupon"); }
  }

  const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:border-orange-400 outline-none";
  const labelClass = "text-xs font-medium text-slate-500 mb-1 block";

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Coupons</h1>
            <p className="text-slate-500 text-sm mt-1">Create discount codes for subscription plans</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "#F97316" }}
          >
            <Plus size={16} /> Create Coupon
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 font-display">New Coupon</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Coupon Code *</label>
                  <input className={inputClass} placeholder="e.g. SAVE20" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                  <p className="text-[10px] text-slate-400 mt-1">Alphanumeric, will be auto-uppercased</p>
                </div>
                <div>
                  <label className={labelClass}>Discount Type *</label>
                  <select className={inputClass} value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="rupees">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Discount Value *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      {form.discount_type === "percentage" ? "%" : "₹"}
                    </span>
                    <input className={`${inputClass} pl-7`} type="number" min="0.01" step="0.01" placeholder={form.discount_type === "percentage" ? "20" : "50"} value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Max Total Redemptions *</label>
                  <input className={inputClass} type="number" min="1" placeholder="100" value={form.max_redemptions} onChange={e => setForm(p => ({ ...p, max_redemptions: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Per-User Limit</label>
                  <input className={inputClass} type="number" min="1" placeholder="1" value={form.per_user_limit} onChange={e => setForm(p => ({ ...p, per_user_limit: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Valid Until</label>
                  <input className={inputClass} type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank for no expiry</p>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Applicable Plan (optional — leave blank for any plan)</label>
                  <select className={inputClass} value={form.applicable_plan_id} onChange={e => setForm(p => ({ ...p, applicable_plan_id: e.target.value }))}>
                    <option value="">Any Plan</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: "#F97316" }}>
                  {saving ? "Creating…" : "Create Coupon"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Coupon List */}
        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading…</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16">
            <Tag size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">No coupons yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map(c => (
              <div key={c.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 ${c.is_active ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}>
                {/* Code + badge */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    {c.discount_type === "percentage" ? <Percent size={18} className="text-orange-500" /> : <IndianRupee size={18} className="text-orange-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-800">{c.id}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(c.id); toast.success("Copied!"); }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Copy size={12} />
                      </button>
                      {!c.is_active && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Inactive</span>}
                      {c.applicable_plan_id && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                          {plans.find(p => p.id === c.applicable_plan_id)?.name || "Specific Plan"}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="font-semibold text-orange-600">
                        {c.discount_type === "percentage" ? `${c.discount_value}% off` : `₹${c.discount_value} off`}
                      </span>
                      <span className="flex items-center gap-1"><Users size={11} /> {c.redemption_count}/{c.max_redemptions} used</span>
                      <span>Per-user: {c.per_user_limit}x</span>
                      {c.valid_until && <span className="flex items-center gap-1"><Calendar size={11} /> Expires {c.valid_until}</span>}
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(c.id)} className="text-slate-400 hover:text-orange-500 transition-colors" title={c.is_active ? "Deactivate" : "Activate"}>
                    {c.is_active ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
