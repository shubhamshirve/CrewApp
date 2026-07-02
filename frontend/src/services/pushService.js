/**
 * Photoo Push Notification Service
 * Manages browser push subscription and communicates with backend.
 * VAPID public key is fetched at runtime from the backend (Admin → Settings → API Keys → Web Push).
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

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

  /**
   * Fetch the VAPID public key from the backend.
   * The backend reads it from the platform_secrets DB (Admin → Settings → API Keys → Web Push),
   * falling back to the VAPID_PUBLIC_KEY environment variable.
   */
  async fetchVapidPublicKey() {
    const res = await fetch(`${BACKEND_URL}/api/push/vapid-public-key`);
    if (!res.ok) throw new Error("Failed to fetch VAPID public key from server");
    const data = await res.json();
    if (!data.vapid_public_key) {
      throw new Error("VAPID public key is not configured. Set it in Admin → Settings → API Keys → Web Push.");
    }
    return data.vapid_public_key;
  },

  /** Subscribe browser to push service */
  async subscribe() {
    const vapidKey = await this.fetchVapidPublicKey();

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
