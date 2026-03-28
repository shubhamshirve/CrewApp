import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { BarChart3, Users, ShieldCheck, Wallet, Briefcase, Globe, TrendingUp } from "lucide-react";
import { toast } from "sonner";

function StatCard({ label, value, icon: Icon, color = "#3B82F6", testId }) {
  return (
    <div
      data-testid={testId || `stat-${label}`}
      className="p-5 rounded-2xl border flex items-center gap-4"
      style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white font-display">{value ?? "—"}</p>
        <p className="text-xs text-zinc-500 font-display">{label}</p>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats")
      .then(r => setStats(r.data))
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-white font-display">Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Platform health at a glance</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl border border-white/5 animate-pulse" style={{ background: "#0D1220" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total Users" value={stats?.total_users} icon={Users} color="#3B82F6" testId="stat-total-users" />
            <StatCard label="Verified Users" value={stats?.verified_users} icon={ShieldCheck} color="#10B981" testId="stat-verified-users" />
            <StatCard label="Pending Review" value={stats?.pending_verification} icon={ShieldCheck} color="#F59E0B" testId="stat-pending-verification" />
            <StatCard label="Active Subscriptions" value={stats?.active_subscriptions} icon={Wallet} color="#8B5CF6" testId="stat-subscriptions" />
            <StatCard label="Total Gigs" value={stats?.total_gigs} icon={Briefcase} color="#EC4899" testId="stat-total-gigs" />
            <StatCard label="Public Gigs" value={stats?.public_gigs ?? "—"} icon={Globe} color="#06B6D4" testId="stat-public-gigs" />
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {[
            { href: "/admin/verification", label: "Review ID Verifications", color: "#F59E0B", count: stats?.pending_verification },
            { href: "/admin/users", label: "Manage Users", color: "#3B82F6", count: stats?.total_users },
            { href: "/admin/penalties", label: "Penalty Log", color: "#EF4444", count: null },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-4 rounded-2xl border border-white/8 hover:border-blue-500/30 transition-all group"
              style={{ background: "#0D1220" }}
            >
              <span className="text-sm text-zinc-300 group-hover:text-white transition-colors font-display">{item.label}</span>
              <div className="flex items-center gap-2">
                {item.count != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${item.color}20`, color: item.color }}>
                    {item.count}
                  </span>
                )}
                <TrendingUp size={14} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
