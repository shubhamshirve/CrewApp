/**
 * Photoo Push Notification Service
 * Manages browser push subscription and communicates with backend.
 */

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export const pushService = {
  /** Check browser support */
  isSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  },

  /** Current permission state */
  getPermission() {
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  /** Request notification permission */
  async requestPermission() {
    return await Notification.requestPermission();
  },

  /** Get existing push subscription (if any) */
  async getExistingSubscription() {
    if (!this.isSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  },

  /** Subscribe browser to push service */
  async subscribe() {
    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!vapidKey) throw new Error("VAPID public key not configured");

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    return subscription;
  },

  /** Send subscription to backend */
  async saveSubscription(subscription, api) {
    const json = subscription.toJSON();
    await api.post("/push/subscribe", {
      endpoint: json.endpoint,
      auth: json.keys.auth,
      p256dh: json.keys.p256dh,
      user_agent: navigator.userAgent,
    });
  },

  /** Unsubscribe from push and remove from backend */
  async unsubscribe(api) {
    const existing = await this.getExistingSubscription();
    if (existing) {
      const endpoint = existing.endpoint;
      await existing.unsubscribe();
      try {
        await api.post("/push/unsubscribe", { endpoint });
      } catch {
        // Best-effort cleanup
      }
    }
  },
};
