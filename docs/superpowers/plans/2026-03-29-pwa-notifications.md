# PWA Install Button & Notification Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Install App" button to the login page and implement a post-login notification permission modal that educates users on notification benefits before requesting permission.

**Architecture:** Two new React components (InstallAppButton, NotificationPermissionModal) integrated into the existing Auth.jsx login flow. InstallAppButton uses the BeforeInstallPromptEvent API to trigger native browser install dialogs. NotificationPermissionModal displays after successful login (unless dismissed in past 30 days) and requests notification.permission when accepted.

**Tech Stack:** React 18, Tailwind CSS, Radix UI (Dialog, Button), lucide-react icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|-----------------|
| `frontend/src/components/InstallAppButton.jsx` | Create | Render install button, manage BeforeInstallPromptEvent, trigger native install dialog |
| `frontend/src/components/NotificationPermissionModal.jsx` | Create | Display modal with notification benefits, request Notification.permission, persist dismissal |
| `frontend/src/pages/Auth.jsx` | Modify | Add InstallAppButton to bottom of dialog, integrate NotificationPermissionModal flow after login |

---

## Task 1: Create InstallAppButton Component

**Files:**
- Create: `frontend/src/components/InstallAppButton.jsx`

- [ ] **Step 1: Create the component file with imports and initial structure**

Create file `frontend/src/components/InstallAppButton.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstallAppButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installedMode, setInstalledMode] = useState(false);

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstalledMode(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Reset the deferred prompt variable
    setDeferredPrompt(null);

    // Hide the button after the user has responded
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
  };

  // Only render if the install prompt is available and not already installed
  if (!canInstall || installedMode) {
    return null;
  }

  return (
    <Button
      onClick={handleInstallClick}
      className="w-full mt-4 font-semibold font-display text-white rounded-full"
      style={{ background: '#E05D26' }}
      type="button"
    >
      <Download size={16} className="mr-2" />
      Install App
    </Button>
  );
}
```

- [ ] **Step 2: Verify component exports correctly**

Run: `npm run build 2>&1 | grep -i "installappbutton\|error" | head -20`

Expected: No errors related to InstallAppButton

---

## Task 2: Create NotificationPermissionModal Component

**Files:**
- Create: `frontend/src/components/NotificationPermissionModal.jsx`

- [ ] **Step 1: Create the modal component with Dialog structure**

Create file `frontend/src/components/NotificationPermissionModal.jsx`:

```javascript
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Wallet, Shield } from 'lucide-react';

export default function NotificationPermissionModal({ isOpen, onComplete }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('[Notifications] Permission:', permission);
    } catch (err) {
      console.error('[Notifications] Permission request failed:', err);
    } finally {
      // Mark as dismissed for 30 days
      const dismissUntil = new Date();
      dismissUntil.setDate(dismissUntil.getDate() + 30);
      localStorage.setItem(
        'crewbook_notification_dismissed',
        dismissUntil.toISOString()
      );

      setIsLoading(false);
      onComplete();
    }
  };

  const handleDismiss = () => {
    // Mark as dismissed for 30 days
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 30);
    localStorage.setItem(
      'crewbook_notification_dismissed',
      dismissUntil.toISOString()
    );

    onComplete();
  };

  const benefits = [
    {
      icon: Bell,
      title: 'Gig Notifications',
      desc: 'New matching gigs, bid updates, job confirmations',
    },
    {
      icon: MessageSquare,
      title: 'Crew Communication',
      desc: 'Messages from crew members, connection requests',
    },
    {
      icon: Wallet,
      title: 'Payment & Wallet',
      desc: 'Transaction confirmations, subscription reminders',
    },
    {
      icon: Shield,
      title: 'Admin Updates',
      desc: 'Verification status, profile review feedback',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Stay Connected</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Enable notifications to stay updated on what matters most to you.
          </p>

          <div className="space-y-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon
                      size={20}
                      className="text-orange-500"
                      style={{ color: '#E05D26' }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900 font-display">
                      {benefit.title}
                    </p>
                    <p className="text-xs text-slate-600">{benefit.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={isLoading}
            className="rounded-full"
          >
            Not Now
          </Button>
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="rounded-full font-semibold text-white"
            style={{ background: '#E05D26' }}
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify component exports correctly**

Run: `npm run build 2>&1 | grep -i "notificationpermission\|error" | head -20`

Expected: No errors related to NotificationPermissionModal

---

## Task 3: Integrate InstallAppButton into Auth.jsx

**Files:**
- Modify: `frontend/src/pages/Auth.jsx`

- [ ] **Step 1: Add import for InstallAppButton at the top of Auth.jsx**

Open `frontend/src/pages/Auth.jsx` and add this import after the existing imports (around line 9):

```javascript
import InstallAppButton from '@/components/InstallAppButton';
```

- [ ] **Step 2: Add InstallAppButton to the bottom of the auth dialog**

In `frontend/src/pages/Auth.jsx`, find the closing `</Tabs>` tag (around line 142) and add the button right after it, before the closing `</div>` of the card:

Old code (around lines 142-144):
```javascript
          </Tabs>
        </div>
      </div>
```

New code:
```javascript
          </Tabs>
          <InstallAppButton />
        </div>
      </div>
```

- [ ] **Step 3: Verify the import and placement**

Run: `npm run build 2>&1 | grep -i "auth\|error" | head -20`

Expected: No errors in Auth.jsx

---

## Task 4: Integrate NotificationPermissionModal into Auth.jsx

**Files:**
- Modify: `frontend/src/pages/Auth.jsx`

- [ ] **Step 1: Add import and state for NotificationPermissionModal**

In `frontend/src/pages/Auth.jsx`, add this import after the InstallAppButton import (around line 10):

```javascript
import NotificationPermissionModal from '@/components/NotificationPermissionModal';
```

Then add this state declaration after the existing `const [loading, setLoading]` line (around line 18):

```javascript
  const [showNotificationModal, setShowNotificationModal] = useState(false);
```

- [ ] **Step 2: Check notification modal dismissal status on component mount**

In `frontend/src/pages/Auth.jsx`, add this useEffect hook after the other state declarations (after line 18):

```javascript
  useEffect(() => {
    // Check if notification modal was dismissed recently
    const dismissedUntil = localStorage.getItem('crewbook_notification_dismissed');
    if (dismissedUntil) {
      const dismissDate = new Date(dismissedUntil);
      if (new Date() < dismissDate) {
        // Dismissal period still active, don't show modal
        // This is just for tracking; we'll check again after login
      }
    }
  }, []);
```

Add the required import at the top of the file:

```javascript
import React, { useState, useEffect } from 'react';
```

(Update the existing React import if it's already there)

- [ ] **Step 3: Modify handleLogin to show notification modal instead of immediate redirect**

In `frontend/src/pages/Auth.jsx`, find the `handleLogin` function (around line 20-32). Replace it with:

```javascript
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginData.email, loginData.password);

      // Check if notification modal was dismissed recently
      const dismissedUntil = localStorage.getItem('crewbook_notification_dismissed');
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);

      if (shouldShowModal) {
        // Show notification modal before redirecting
        setShowNotificationModal(true);
        // Store user data for redirect after modal closes
        sessionStorage.setItem('pendingUser', JSON.stringify({
          user,
          action: 'login'
        }));
      } else {
        // Skip modal, redirect immediately
        toast.success(`Welcome back, ${user.full_name}!`);
        navigate(user.is_admin ? '/admin/dashboard' : user.onboarding_complete ? '/dashboard' : '/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Modify handleRegister similarly**

In `frontend/src/pages/Auth.jsx`, find the `handleRegister` function (around line 34-50). Replace it with:

```javascript
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regData.email || !regData.password || !regData.full_name || !regData.phone) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await register(regData);

      // Check if notification modal was dismissed recently
      const dismissedUntil = localStorage.getItem('crewbook_notification_dismissed');
      const shouldShowModal = !dismissedUntil || new Date() >= new Date(dismissedUntil);

      if (shouldShowModal) {
        // Show notification modal before redirecting
        setShowNotificationModal(true);
        // Store redirect action in session
        sessionStorage.setItem('pendingUser', JSON.stringify({
          action: 'register'
        }));
      } else {
        // Skip modal, redirect immediately
        toast.success('Account created! Let\'s set up your profile.');
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 5: Add handler for notification modal completion**

In `frontend/src/pages/Auth.jsx`, add this function after the handleRegister function (around line 50):

```javascript
  const handleNotificationModalComplete = () => {
    // Modal has completed (user accepted or dismissed)
    const pendingUser = sessionStorage.getItem('pendingUser');
    if (pendingUser) {
      const { user, action } = JSON.parse(pendingUser);
      sessionStorage.removeItem('pendingUser');

      if (action === 'login') {
        toast.success(`Welcome back, ${user.full_name}!`);
        navigate(user.is_admin ? '/admin/dashboard' : user.onboarding_complete ? '/dashboard' : '/onboarding');
      } else if (action === 'register') {
        toast.success('Account created! Let\'s set up your profile.');
        navigate('/onboarding');
      }
    }
    setShowNotificationModal(false);
  };
```

- [ ] **Step 6: Add NotificationPermissionModal component to JSX**

In `frontend/src/pages/Auth.jsx`, add this component before the closing `</div>` of the main container (after line 145, before the final `</div>`):

```javascript
      <NotificationPermissionModal
        isOpen={showNotificationModal}
        onComplete={handleNotificationModalComplete}
      />
```

- [ ] **Step 7: Verify all changes compile**

Run: `npm run build 2>&1 | grep -i "error" | head -20`

Expected: No errors

---

## Task 5: Test the Flow Manually

**Files:**
- Test: `frontend/src/pages/Auth.jsx`, `frontend/src/components/InstallAppButton.jsx`, `frontend/src/components/NotificationPermissionModal.jsx`

- [ ] **Step 1: Start the development server**

Run from `frontend/` directory:
```bash
npm start
```

Expected: Dev server starts, no errors in console

- [ ] **Step 2: Test InstallAppButton visibility**

- Open browser DevTools (F12)
- Navigate to login page (`http://localhost:3000/auth`)
- Check if "Install App" button appears at the bottom of the login dialog
  - On Chrome/Edge/Brave: should appear (these support the install prompt)
  - On Safari/Firefox: may not appear (limited/no support for BeforeInstallPromptEvent)
- Check browser console for any errors related to InstallAppButton

- [ ] **Step 3: Test install prompt trigger (Chrome/Edge only)**

- Click "Install App" button
- Native browser install dialog should appear
- Accept the install prompt
- Verify button disappears after install
- Check console for "[CrewBook SW] Registered" message (service worker is active)

- [ ] **Step 4: Test notification modal after login**

- Clear localStorage: `localStorage.clear()` in console
- Fill in login form with test credentials (admin@crewbook.in / Admin@123)
- Submit login form
- Notification modal should appear with all 4 benefits (Gigs, Messages, Payments, Admin)
- Verify "Enable Notifications" button is visible
- Verify "Not Now" button is visible

- [ ] **Step 5: Test "Enable Notifications" flow**

- Click "Enable Notifications" button on the modal
- Browser notification permission dialog should appear (on Chrome/Firefox)
  - If prompted: choose "Allow" or "Block"
- Modal should close
- Page should redirect to dashboard or onboarding
- Verify localStorage has `crewbook_notification_dismissed` key set to 30 days from now
- Run in console: `localStorage.getItem('crewbook_notification_dismissed')`
- Expected: Date string 30 days in the future

- [ ] **Step 6: Test "Not Now" flow**

- Clear localStorage again
- Log out (if still logged in)
- Login again to trigger modal
- Click "Not Now" button
- Modal should close without requesting notification permission
- Page should redirect to dashboard or onboarding
- Verify localStorage has `crewbook_notification_dismissed` key
- On next login, modal should NOT appear (within 30 days)

- [ ] **Step 7: Test modal doesn't appear if recently dismissed**

- Stay logged in or log out and back in
- Modal should NOT appear (since we dismissed it 30 days)
- Verify redirect happens immediately after login

- [ ] **Step 8: Check for console errors**

- Open DevTools Console
- Perform all steps above
- Verify no JavaScript errors appear
- Verify service worker logs appear: "[CrewBook SW] Registered: /"

---

## Task 6: Commit Changes

**Files:**
- Modified: `frontend/src/pages/Auth.jsx`
- Created: `frontend/src/components/InstallAppButton.jsx`
- Created: `frontend/src/components/NotificationPermissionModal.jsx`

- [ ] **Step 1: Check git status**

Run: `git status`

Expected output should show:
```
modified:   frontend/src/pages/Auth.jsx
??  frontend/src/components/InstallAppButton.jsx
??  frontend/src/components/NotificationPermissionModal.jsx
```

- [ ] **Step 2: Stage all changes**

Run: `git add frontend/src/pages/Auth.jsx frontend/src/components/InstallAppButton.jsx frontend/src/components/NotificationPermissionModal.jsx`

- [ ] **Step 3: Create commit**

Run:
```bash
git commit -m "feat: add PWA install button and notification permission modal

- Add InstallAppButton component to login page (bottom of dialog)
  - Uses BeforeInstallPromptEvent API for native browser install
  - Hidden on unsupported browsers or if already installed
- Add NotificationPermissionModal component
  - Shows after successful login with all 4 notification benefit categories
  - User can enable or dismiss (30-day dismissal window)
  - Requests Notification.permission when accepted
- Integrate both components into Auth.jsx login/register flow
  - Notification modal shown post-login before redirect
  - Dismissal preference persisted in localStorage

Closes PWA notification implementation"
```

- [ ] **Step 4: Verify commit**

Run: `git log --oneline -1`

Expected: Latest commit shows the PWA feature commit message

---

## Spec Coverage Verification

| Spec Section | Task(s) | Status |
|--------------|---------|--------|
| InstallAppButton component | Task 1 | ✅ |
| NotificationPermissionModal component | Task 2 | ✅ |
| Install button placement (bottom of dialog) | Task 3 | ✅ |
| Post-login notification modal flow | Task 4 | ✅ |
| BeforeInstallPromptEvent handling | Task 1 | ✅ |
| Notification.requestPermission() | Task 2 | ✅ |
| localStorage persistence (30 days) | Task 2, Task 4 | ✅ |
| Service worker already in place | N/A (existing) | ✅ |
| Error handling (graceful fallbacks) | Task 2, 5 | ✅ |
| Design system alignment | Task 1, 2 | ✅ |

---

## Success Criteria

✅ InstallAppButton renders only on PWA-capable browsers
✅ Install button appears at bottom of login dialog
✅ Clicking install button triggers native browser install dialog
✅ NotificationPermissionModal appears after successful login
✅ Modal displays all 4 notification benefit categories
✅ "Enable Notifications" requests Notification.permission
✅ "Not Now" dismisses without requesting permission
✅ Dismissal persisted for 30 days in localStorage
✅ No browser console errors
✅ Service worker already receives push notifications
✅ All changes committed to git
