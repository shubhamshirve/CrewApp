import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS = {
  invite: "#F59E0B",
  accepted: "#10B981",
  rejected: "#EF4444",
  counter: "#8B5CF6",
  connection_request: "#3B82F6",
  connection_accepted: "#10B981",
  wallet_credit: "#F59E0B",
  verification: "#3B82F6",
  penalty: "#EF4444",
  subscription: "#10B981",
  data_delivered: "#10B981",
};

export default function Notifications() {
  const { api } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch { } finally { setLoading(false); }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications(p => p.map(n => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const grouped = notifications.reduce((acc, n) => {
    const date = new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white font-display">Notifications</h1>
            {unreadCount > 0 && <p className="text-sm text-zinc-500 mt-0.5">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" data-testid="mark-all-read-btn" onClick={markAllRead} variant="outline" className="border-white/10 text-zinc-400 hover:text-white gap-1.5 text-xs font-display">
              <CheckCheck size={13} /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No notifications yet</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs text-zinc-600 font-display uppercase tracking-wide mb-3">{date}</p>
              <div className="space-y-2">
                {items.map(n => (
                  <div
                    key={n.id}
                    data-testid={`notification-${n.id}`}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${!n.is_read ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/8" : "border-white/5 hover:border-white/10"}`}
                    style={{ background: n.is_read ? "#131315" : undefined }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.is_read ? "#3f3f46" : (TYPE_COLORS[n.type] || "#F59E0B") }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-display font-medium ${n.is_read ? "text-zinc-300" : "text-white"}`}>{n.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">{new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      {!n.is_read && (
                        <button onClick={e => { e.stopPropagation(); markRead(n.id); }} className="text-zinc-600 hover:text-amber-400 flex-shrink-0" data-testid={`mark-read-${n.id}`}>
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
