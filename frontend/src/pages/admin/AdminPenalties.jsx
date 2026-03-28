import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminPenalties() {
  const { api } = useAuth();
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/penalties")
      .then(r => setPenalties(r.data))
      .catch(() => {
        // Endpoint may not exist yet — show empty state
        setPenalties([]);
      })
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-white font-display">Penalty Log</h1>
          <p className="text-zinc-500 text-sm mt-1">History of all platform penalties</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : penalties.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle size={40} className="text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">No penalties recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {penalties.map((p, i) => (
              <div
                key={p.id || i}
                data-testid={`penalty-row-${p.id || i}`}
                className="flex items-start justify-between p-4 rounded-2xl border"
                style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-medium text-white font-display">{p.user_name || p.user_id}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.reason}</p>
                  <p className="text-xs text-zinc-600 mt-1">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 flex-shrink-0">
                  -{p.stars} star{p.stars !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
