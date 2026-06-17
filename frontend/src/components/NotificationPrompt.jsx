import React, { useState, useEffect } from "react";
import { Bell, X, BellOff } from "lucide-react";
import { pushService } from "@/services/pushService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Shown once after login if notification permission is 'default'.
 * Allows user to enable push notifications or dismiss permanently.
 */
export default function NotificationPrompt() {
  const { api } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pushService.isSupported()) return;
    const permission = pushService.getPermission();
    const dismissed = localStorage.getItem("photoo_notif_dismissed");
    if (permission === "default" && !dismissed) {
      // Small delay so it doesn't flash on initial load
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await pushService.requestPermission();
      if (permission === "granted") {
        const sub = await pushService.subscribe();
        await pushService.saveSubscription(sub, api);
        toast.success("Push notifications enabled!");
      } else {
        toast.info("Notifications blocked. You can enable them from browser settings.");
      }
    } catch (err) {
      toast.error("Could not enable notifications");
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("photoo_notif_dismissed", "1");
    setVisible(false);
  };

  return (
    <div
      data-testid="notification-prompt"
      className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: "#EFF6FF", border: "1.5px solid #3B82F6" }}
    >
      <div className="flex items-center gap-2.5">
        <Bell size={16} className="text-blue-500 flex-shrink-0" />
        <span className="text-blue-900 font-display font-medium">
          Enable push notifications to stay updated on gig invites & bookings
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          data-testid="enable-notifications-btn"
          onClick={handleEnable}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: "#3B82F6" }}
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enabling...
            </span>
          ) : (
            <><Bell size={11} /> Enable</>
          )}
        </button>
        <button
          data-testid="dismiss-notification-prompt"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-all"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Notification settings toggle for the Settings page.
 */
export function NotificationToggle() {
  const { api } = useAuth();
  const [status, setStatus] = useState(null); // 'granted' | 'denied' | 'default'
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pushService.isSupported()) return;
    setStatus(pushService.getPermission());
    api.get("/push/status").then(r => setSubscribed(r.data.subscribed)).catch(() => {});
  }, [api]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await pushService.unsubscribe(api);
        setSubscribed(false);
        toast.success("Push notifications disabled");
      } else {
        const permission = await pushService.requestPermission();
        setStatus(permission);
        if (permission === "granted") {
          const sub = await pushService.subscribe();
          await pushService.saveSubscription(sub, api);
          setSubscribed(true);
          toast.success("Push notifications enabled!");
        } else {
          toast.info("Permission denied. Enable from browser settings.");
        }
      }
    } catch {
      toast.error("Could not update notification settings");
    } finally {
      setLoading(false);
    }
  };

  if (!pushService.isSupported()) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <BellOff size={14} /> Push notifications not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-800 font-display">Push Notifications</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {status === "denied"
            ? "Blocked by browser — enable in browser settings"
            : subscribed
            ? "You'll receive gig invites, bookings & updates"
            : "Get notified about new gigs, invites and messages"}
        </p>
      </div>
      <button
        data-testid="notification-toggle-btn"
        onClick={handleToggle}
        disabled={loading || status === "denied"}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          subscribed ? "bg-blue-500" : "bg-slate-300"
        } disabled:opacity-40`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            subscribed ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
