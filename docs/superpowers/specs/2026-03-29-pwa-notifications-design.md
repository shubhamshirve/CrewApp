# PWA Install & Notification Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Add "Install App" button to login page + post-login notification permission flow

---

## Overview

CrewBook already has PWA infrastructure (manifest.json, service worker, icons). This spec completes the PWA experience by:

1. **Install Prompt Button** — users can install the app directly from login page
2. **Notification Permission Flow** — post-login modal explains benefits, then requests permission

---

## Architecture

### User Journey

```
Login Page
  ↓
[Install App Button] ← visible on supported browsers/devices
  ↓
User submits login/register
  ↓
Auth succeeds
  ↓
[Notification Permission Modal] ← explains benefits
  ↓
User accepts → request Notification.permission
User declines → skip, remember choice (localStorage)
  ↓
Redirect to dashboard/onboarding
```

### Browser APIs Used

| API | Purpose | Fallback |
|-----|---------|----------|
| `BeforeInstallPromptEvent` | Trigger native install dialog | Button hidden on unsupported browsers |
| `Notification.requestPermission()` | Request notification permission | Modal still shows, permission request fails gracefully |
| `localStorage` | Store "don't ask again" preference | Session-only if unavailable |

---

## Components

### 1. InstallAppButton

**Location:** `frontend/src/components/InstallAppButton.jsx`

**Behavior:**
- Renders only when `BeforeInstallPromptEvent` has fired (PWA-installable state)
- Text: "Install App"
- On click: Trigger the native browser install prompt
- After user accepts/declines install: hide button
- Styling: Tailwind, matches login page design (white bg, orange text or vice versa)

**Props:** None (uses internal state)

**State:**
- `canInstall` (boolean) — tracks if install prompt is available
- `installedMode` (boolean) — hide if already installed

**Event Handlers:**
- Listen to `beforeinstallprompt` event → set `canInstall = true`
- Listen to `appinstalled` event → set `installedMode = true`

---

### 2. NotificationPermissionModal

**Location:** `frontend/src/components/NotificationPermissionModal.jsx`

**Purpose:** Educate user on notification benefits before requesting permission

**Content:**
- Title: "Stay Connected"
- Subtitle: "Enable notifications to stay updated"
- Benefit list (checkmarks):
  - 🎬 **Gig Notifications** — new matching gigs, bid updates, job confirmations
  - 💬 **Crew Communication** — messages, connection requests
  - 💰 **Payment & Wallet** — transaction confirmations, subscription reminders
  - 👨‍💼 **Admin Updates** — verification status, profile feedback
- Buttons:
  - "Enable Notifications" (primary, orange)
  - "Not Now" (secondary, gray)

**Behavior:**
- Shown after successful login/register
- Auto-dismisses after user action or 30 seconds (if no action)
- On "Enable": call `Notification.requestPermission()` → then redirect
- On "Not Now": skip permission request, redirect immediately
- Check localStorage for `crewbook_notification_dismissed` flag (don't re-ask for 30 days)

**Props:**
- `onComplete` (function) — callback after modal closes (allows auth flow to redirect)

---

### 3. Auth Flow Integration

**Location:** `frontend/src/contexts/AuthContext.js` + `frontend/src/pages/Auth.jsx`

**Changes:**
- After successful login/register, before redirect:
  - Check if `crewbook_notification_dismissed` exists in localStorage
  - If not → show `<NotificationPermissionModal onComplete={() => redirect()} />`
  - If yes → redirect immediately

**Code Pattern:**
```javascript
const handleLogin = async (e) => {
  // ... existing login logic ...
  const user = await login(email, password);

  // Check if we should show notification modal
  const dismissed = localStorage.getItem('crewbook_notification_dismissed');
  if (!dismissed) {
    // Show modal, modal will call onComplete callback
    setShowNotificationModal(true);
  } else {
    // Skip directly to redirect
    redirect(user);
  }
};
```

---

## Implementation Details

### InstallAppButton

**Event Listeners:**

```javascript
// In component mount
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
  setCanInstall(true);
});

window.addEventListener('appinstalled', () => {
  setInstalledMode(true);
});
```

**Click Handler:**

```javascript
const handleInstallClick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    setCanInstall(false); // Hide button after install
  }
};
```

**Rendering:**

```javascript
if (!canInstall || installedMode) return null;
return (
  <Button
    onClick={handleInstallClick}
    className="w-full mt-4 font-semibold text-white"
    style={{ background: "#E05D26" }}
  >
    Install App
  </Button>
);
```

**Placement in Auth.jsx:**
- At the very bottom of the dialog, after the Tabs component

---

### NotificationPermissionModal

**Structure:**

```jsx
<Dialog open={isOpen} onOpenChange={handleClose}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Stay Connected</DialogTitle>
    </DialogHeader>

    <p className="text-sm text-slate-600">
      Enable notifications to stay updated on what matters
    </p>

    <ul className="space-y-3 my-4">
      <li>🎬 Gig Notifications...</li>
      <li>💬 Crew Communication...</li>
      <li>💰 Payment & Wallet...</li>
      <li>👨‍💼 Admin Updates...</li>
    </ul>

    <DialogFooter>
      <Button variant="outline" onClick={handleDismiss}>
        Not Now
      </Button>
      <Button onClick={handleEnable} style={{ background: "#E05D26" }}>
        Enable Notifications
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Permission Request Logic:**

```javascript
const handleEnable = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notifications enabled');
    }
  } catch (err) {
    console.error('Permission request failed:', err);
  } finally {
    setDismissedUntil(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    localStorage.setItem(
      'crewbook_notification_dismissed',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );
    onComplete();
  }
};

const handleDismiss = () => {
  localStorage.setItem(
    'crewbook_notification_dismissed',
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  );
  onComplete();
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/InstallAppButton.jsx` | Create | Install prompt button |
| `frontend/src/components/NotificationPermissionModal.jsx` | Create | Notification education + permission request |
| `frontend/src/pages/Auth.jsx` | Modify | Add InstallAppButton at bottom of dialog; integrate notification modal flow |
| `frontend/src/contexts/AuthContext.js` | Modify | Add notification modal state to auth context or handle in Auth.jsx directly |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Browser doesn't support install prompt | InstallAppButton hidden (conditional render) |
| User already installed app | InstallAppButton hidden |
| Notification permission denied | Modal still closes, app continues normally |
| Notification API unavailable | Modal still shows (graceful), permission request fails silently |
| localStorage unavailable | Use session-only tracking (no re-ask persistence) |

---

## Testing Considerations

- Test on Chrome/Edge (full PWA support)
- Test on Safari iOS (limited PWA, no install prompt)
- Test on Firefox (PWA support varies)
- Test with notifications enabled/disabled
- Test localStorage persistence
- Verify modal doesn't block redirect if permission fails

---

## Design System Alignment

- **Colors:** Orange accent (#E05D26) for primary buttons, slate grays for secondary
- **Typography:** Outfit (headings), Manrope (body)
- **Radius:** `rounded-3xl` for cards/modals, `rounded-full` for buttons
- **Spacing:** Consistent with existing Tailwind scale
- **Tone:** Friendly, non-pushy (users can decline without friction)

---

## Future Enhancements

- Add notification preferences in user settings (choose which notifications to receive)
- Track notification permission state in user profile (backend)
- A/B test modal messaging for conversion optimization
- Add re-engagement prompts if user declines initially

---

## Success Criteria

✅ Install button appears only on installable browsers
✅ Native install dialog triggers on button click
✅ Notification modal shows post-login with all 4 benefit categories
✅ User can accept/decline without friction
✅ Dismissed preference persisted for 30 days
✅ App continues normally regardless of user choice
✅ Service worker receives push notifications correctly
