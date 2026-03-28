import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Globe, Loader2, MapPin, Calendar, Users, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

export default function AdminGigBoard() {
  const { api } = useAuth();
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Admin can see all gigs including their own since they are lead_id
      // Use the same endpoint but we'll patch the filter on FE side
      const r = await api.get("/public-gigs/my-posts");
      // Also fetch general board — combine and dedupe by id
      // For admin view, ideally we'd have /admin/public-gigs endpoint
      // For now, fetch the public board (excludes admin's own posts)
      const r2 = await api.get("/public-gigs");
      const all = [...r.data, ...r2.data];
      const seen = new Set();
      const deduped = all.filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
      setGigs(deduped);
    } catch { toast.error("Failed to load gigs"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (gigId) => {
    if (!window.confirm("Cancel this gig?")) return;
    try {
      await api.put(`/public-gigs/${gigId}/cancel`);
      toast.success("Gig cancelled");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const STATUS_COLORS = {
    open: "text-emerald-600 bg-emerald-500/15",
    partially_filled: "text-amber-700 bg-amber-500/15",
    filled: "text-slate-500 bg-slate-100",
    expired: "text-red-600 bg-red-500/15",
    cancelled: "text-red-600 bg-red-500/15",
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground font-display">Gig Board</h1>
          <p className="text-muted-foreground text-sm mt-1">All public gig listings on the platform</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20">
            <Globe size={40} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">No public gigs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gigs.map(g => (
              <div
                key={g.id}
                data-testid={`admin-gig-row-${g.id}`}
                className="p-5 rounded-2xl border border-border bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[g.status] || STATUS_COLORS.open}`}>
                        {g.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground font-display">{g.title}</p>
                    <p className="text-xs text-muted-foreground">by {g.lead_name} · {g.event_type}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {g.date}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {g.city}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {g.application_count} apps</span>
                    </div>
                  </div>
                  {g.status !== "cancelled" && g.status !== "filled" && (
                    <button
                      onClick={() => handleCancel(g.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors ml-4 flex-shrink-0"
                    >
                      <X size={11} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
