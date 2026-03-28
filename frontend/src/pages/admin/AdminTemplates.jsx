import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Save, RefreshCw, ChevronDown, ChevronUp,
  Info, CheckCircle, AlertCircle, MessageCircle, Mail, Send
} from "lucide-react";
import { toast } from "sonner";

const inputClass = "bg-slate-50 border border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/60 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-1 focus:ring-blue-500/30 transition-all";
const textareaClass = `${inputClass} resize-none leading-relaxed`;

const CHANNEL_TABS = [
  { id: "platform", icon: MessageCircle, label: "In-App" },
  { id: "whatsapp", icon: MessageSquare, label: "WhatsApp" },
  { id: "email", icon: Mail, label: "Email" },
];

function VariablePill({ variable }) {
  return (
    <code
      className="text-[10px] px-1.5 py-0.5 rounded font-mono cursor-pointer select-all bg-blue-50 text-blue-700 border border-blue-200"
      title="Click to copy"
      onClick={() => { navigator.clipboard.writeText(`{{${variable}}}`); toast.success(`Copied {{${variable}}}`); }}
    >
      {`{{${variable}}}`}
    </code>
  );
}

function TemplateCard({ template, onSave }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("platform");
  const [form, setForm] = useState({
    platform_message: template.platform_message || "",
    whatsapp_template_name: template.whatsapp_template_name || "",
    whatsapp_language_code: template.whatsapp_language_code || "en",
    email_subject: template.email_subject || "",
    email_body: template.email_body || "",
    is_active: template.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      platform_message: template.platform_message || "",
      whatsapp_template_name: template.whatsapp_template_name || "",
      whatsapp_language_code: template.whatsapp_language_code || "en",
      email_subject: template.email_subject || "",
      email_body: template.email_body || "",
      is_active: template.is_active !== false,
    });
  }, [template]);

  const hasContent = template.platform_message || template.whatsapp_template_name || template.email_subject;

  const handleSave = async () => {
    setSaving(true);
    await onSave(template.event_type, form);
    setSaving(false);
  };

  return (
    <div
      data-testid={`template-card-${template.event_type}`}
      className={`rounded-xl border transition-all bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${open ? "border-blue-300" : "border-border"}`}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasContent ? "bg-emerald-500" : "bg-slate-300"}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground font-display truncate">{template.label}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <div className="hidden sm:flex gap-1.5">
            {template.platform_message && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-display bg-amber-500/15 text-amber-700">In-App</span>
            )}
            {template.whatsapp_template_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-display bg-emerald-500/15 text-emerald-700">WhatsApp</span>
            )}
            {template.email_subject && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-display bg-violet-500/15 text-violet-700">Email</span>
            )}
          </div>
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded editor */}
      {open && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          {/* Variables hint */}
          <div className="flex flex-wrap gap-1.5 mb-4 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <span className="text-[10px] text-muted-foreground font-display mr-1 self-center">Variables:</span>
            {template.variables?.map(v => <VariablePill key={v} variable={v} />)}
          </div>

          <Tabs value={channel} onValueChange={setChannel}>
            <TabsList className="border border-border bg-slate-100 mb-4">
              {CHANNEL_TABS.map(({ id, icon: Icon, label }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm font-display text-xs gap-1.5"
                >
                  <Icon size={11} /> {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* In-App */}
            <TabsContent value="platform">
              <div>
                <label className="text-xs text-muted-foreground font-display mb-1.5 block">In-App Notification Message</label>
                <textarea
                  data-testid={`platform-msg-${template.event_type}`}
                  className={`${textareaClass} h-20`}
                  placeholder={`e.g. Hi {{freelancer_name}}, you have a new invite for {{gig_title}}`}
                  value={form.platform_message}
                  onChange={e => setForm(p => ({ ...p, platform_message: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1 font-display">Use {`{{variable}}`} for dynamic values. Click a variable pill above to copy.</p>
              </div>
            </TabsContent>

            {/* WhatsApp */}
            <TabsContent value="whatsapp">
              <div className="space-y-3">
                <div className="p-3 rounded-lg flex items-start gap-2 bg-emerald-50 border border-emerald-200">
                  <Info size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-600 font-display">
                    Enter the exact template name from your Meta WhatsApp Business Manager. These are pre-approved message templates. Credentials needed to activate.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1.5 block">WhatsApp Approved Template Name</label>
                  <input
                    data-testid={`wa-template-${template.event_type}`}
                    className={inputClass}
                    placeholder="e.g. gig_invite_notification"
                    value={form.whatsapp_template_name}
                    onChange={e => setForm(p => ({ ...p, whatsapp_template_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1.5 block">Language Code</label>
                  <select
                    className={inputClass}
                    value={form.whatsapp_language_code}
                    onChange={e => setForm(p => ({ ...p, whatsapp_language_code: e.target.value }))}
                  >
                    <option value="en">English (en)</option>
                    <option value="en_US">English US (en_US)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="mr">Marathi (mr)</option>
                    <option value="ta">Tamil (ta)</option>
                    <option value="te">Telugu (te)</option>
                    <option value="kn">Kannada (kn)</option>
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* Email */}
            <TabsContent value="email">
              <div className="space-y-3">
                <div className="p-3 rounded-lg flex items-start gap-2 bg-violet-50 border border-violet-200">
                  <Info size={13} className="text-violet-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-600 font-display">
                    Email templates use inline HTML. Add your Resend API key to activate live email sending.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1.5 block">Email Subject Line</label>
                  <input
                    data-testid={`email-subject-${template.event_type}`}
                    className={inputClass}
                    placeholder={`e.g. New Gig Invite: {{gig_title}}`}
                    value={form.email_subject}
                    onChange={e => setForm(p => ({ ...p, email_subject: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1.5 block">Email Body (HTML supported)</label>
                  <textarea
                    data-testid={`email-body-${template.event_type}`}
                    className={`${textareaClass} h-32`}
                    placeholder="<p>Hi {{freelancer_name}},</p><p>You have a new invite...</p>"
                    value={form.email_body}
                    onChange={e => setForm(p => ({ ...p, email_body: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Active toggle + save */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${form.is_active ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-muted-foreground font-display">{form.is_active ? "Active" : "Inactive"}</span>
            </label>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              data-testid={`save-template-${template.event_type}`}
              className="text-xs gap-1.5"
              style={{ background: "#1D4ED8", color: "#fff" }}
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTemplates() {
  const { api } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/templates");
      setTemplates(res.data.templates || []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (eventType, formData) => {
    try {
      await api.put(`/templates/${eventType}`, formData);
      toast.success("Template saved!");
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Failed to save template";
      toast.error(msg);
    }
  };

  const filtered = templates.filter(t =>
    t.label.toLowerCase().includes(search.toLowerCase()) ||
    t.event_type.toLowerCase().includes(search.toLowerCase())
  );

  const configured = templates.filter(t => t.has_saved).length;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-foreground font-display">Notification Templates</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage platform, WhatsApp, and email templates for each event</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="border-border text-slate-600 text-xs gap-1 flex-shrink-0"
          >
            <RefreshCw size={12} /> Refresh
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Events", value: templates.length, icon: MessageSquare, color: "#3B82F6" },
            { label: "Configured", value: configured, icon: CheckCircle, color: "#10B981" },
            { label: "Pending Setup", value: templates.length - configured, icon: AlertCircle, color: "#F59E0B" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-3 border border-border bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} style={{ color }} />
                <span className="text-[10px] text-muted-foreground font-display">{label}</span>
              </div>
              <p className="text-xl font-bold text-foreground font-display">{value}</p>
            </div>
          ))}
        </div>

        {/* Channel legend */}
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-slate-50">
          <span className="text-[10px] text-muted-foreground font-display self-center mr-1">Channels:</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-display bg-amber-500/15 text-amber-700">In-App Notification</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-display bg-emerald-500/15 text-emerald-700">WhatsApp (requires Meta credentials)</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-display bg-violet-500/15 text-violet-700">Email (requires Resend API key)</span>
        </div>

        {/* Search */}
        <input
          data-testid="template-search"
          className={inputClass}
          placeholder="Search templates by name or event type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Template list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(tmpl => (
              <TemplateCard key={tmpl.event_type} template={tmpl} onSave={handleSave} />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-display">No templates found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
