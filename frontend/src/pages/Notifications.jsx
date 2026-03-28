import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { pushService } from "@/services/pushService";

const TYPE_COLORS = {
  invite: "#F97316",
  accepted: "#10B981",
  rejected: "#EF4444",
  counter: "#8B5CF6",
  connection_request: "#3B82F6",
  connection_accepted: "#10B981",
  wallet_credit: "#F97316",
  verification: "#3B82F6",
  penalty: "#EF4444",
  subscription: "#10B981",
  data_delivered: "#10B981",
};

export default function Notifications() {
  const { api } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState("default"); // 'default' | 'granted' | 'denied' | 'subscribed'
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => { load(); checkPushState(); }, []);

  const checkPushState = async () => {
    if (!pushService.isSupported()) return;
    const perm = pushService.getPermission();
    if (perm === "granted") {
      const existing = await pushService.getExistingSubscription();
      setPushState(existing ? "subscribed" : "granted");
    } else {
      setPushState(perm); // 'default' or 'denied'
    }
  };

  const handleEnablePush = async () => {
    if (!pushService.isSupported()) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }
    setPushLoading(true);
    try {
      const perm = await pushService.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission denied. Please allow notifications in your browser settings.");
        setPushState("denied");
        return;
      }
      const subscription = await pushService.subscribe();
      await pushService.saveSubscription(subscription, api);
      setPushState("subscribed");
      toast.success("Push notifications enabled!");
    } catch (err) {
      toast.error(err.message || "Failed to enable push notifications");
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await pushService.unsubscribe(api);
      setPushState("default");
      toast.success("Push notifications disabled");
    } catch {
      toast.error("Failed to disable push notifications");
    } finally {
      setPushLoading(false);
    }
  };

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
            <h1 className="text-2xl font-semibold text-slate-900 font-display">Notifications</h1>
            {unreadCount > 0 && <p className="text-sm text-slate-500 mt-0.5">{unreadCount} unread</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* Push notification toggle */}
            {pushService.isSupported() && (
              pushState === "subscribed" ? (
                <Button
                  size="sm"
                  data-testid="disable-push-btn"
                  onClick={handleDisablePush}
                  disabled={pushLoading}
                  variant="outline"
                  className="border-slate-200 text-slate-500 hover:text-red-500 gap-1.5 text-xs font-display"
                >
                  <BellOff size={13} /> {pushLoading ? "..." : "Disable Alerts"}
                </Button>
              ) : pushState === "denied" ? (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <BellOff size={12} /> Notifications blocked
                </span>
              ) : (
                <Button
                  size="sm"
                  data-testid="enable-push-btn"
                  onClick={handleEnablePush}
                  disabled={pushLoading}
                  className="gap-1.5 text-xs font-display text-white"
                  style={{ background: "#E05D26" }}
                >
                  <BellRing size={13} /> {pushLoading ? "Enabling..." : "Enable Alerts"}
                </Button>
              )
            )}
            {unreadCount > 0 && (
              <Button size="sm" data-testid="mark-all-read-btn" onClick={markAllRead} variant="outline" className="border-slate-200 text-slate-500 hover:text-slate-900 gap-1.5 text-xs font-display">
                <CheckCheck size={13} /> Mark all read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No notifications yet</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs text-slate-400 font-display uppercase tracking-wide mb-3">{date}</p>
              <div className="space-y-2">
                {items.map(n => (
                  <div
                    key={n.id}
                    data-testid={`notification-${n.id}`}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      !n.is_read
                        ? "border-orange-200 bg-orange-50 hover:bg-orange-100/60"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: n.is_read ? "#CBD5E1" : (TYPE_COLORS[n.type] || "#F97316") }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-display font-medium ${n.is_read ? "text-slate-600" : "text-slate-900"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(n.id); }}
                          className="text-slate-400 hover:text-orange-500 flex-shrink-0"
                          data-testid={`mark-read-${n.id}`}
                        >
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
