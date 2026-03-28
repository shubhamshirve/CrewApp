# Remove Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the marketing landing page and make the Auth (Login & Registration) page the first thing users see when they visit the app.

**Architecture:** Simple routing refactor. The root path `/` will render the existing Auth component instead of the Landing component. The `/auth` route is removed entirely. The Landing.jsx file is deleted.

**Tech Stack:** React 18, React Router, Frontend routing only — no backend changes

---

## File Structure

**Files to modify:**
- `frontend/src/App.js` — Update routing logic (remove Landing import, change root route, remove /auth route)

**Files to delete:**
- `frontend/src/pages/Landing.jsx` — No longer needed

---

## Task 1: Update App.js Routing

**Files:**
- Modify: `frontend/src/App.js` (lines 8, 85-86)

### Step 1: Remove Landing import

- [ ] Open `frontend/src/App.js`
- [ ] Find line 8: `import Landing from "@/pages/Landing";`
- [ ] Delete this entire line

**Result:** Line 8 should now be `import Auth from "@/pages/Auth";` (or the next import)

### Step 2: Update root route (change Landing to Auth)

- [ ] In the `UserRoutes()` function, find the root route (around line 85)
- [ ] Current code:
```javascript
<Route path="/" element={!user ? <Landing /> : user.is_admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />} />
```

- [ ] Change to:
```javascript
<Route path="/" element={!user ? <Auth /> : user.is_admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />} />
```

**What changed:** `<Landing />` → `<Auth />`

### Step 3: Remove the /auth route

- [ ] Find line 86 (the /auth route definition):
```javascript
<Route path="/auth" element={!user ? <Auth /> : user.is_admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />} />
```

- [ ] Delete this entire line

**Result:** The /auth route no longer exists

### Step 4: Verify App.js syntax

- [ ] Check that the file has no syntax errors by looking at the code
- [ ] Make sure imports at the top are still valid (Landing import removed, Auth import still exists)
- [ ] Make sure the UserRoutes() function still has valid JSX

### Step 5: Commit

- [ ] Run:
```bash
git add frontend/src/App.js
git commit -m "refactor: route auth page to root path, remove landing page route"
```

**Expected output:** Git shows 1 file changed with ~3-5 line changes

---

## Task 2: Delete Landing.jsx

**Files:**
- Delete: `frontend/src/pages/Landing.jsx`

### Step 1: Delete the file

- [ ] Delete `frontend/src/pages/Landing.jsx`

**How:** Use your file explorer or IDE to delete the file (Cmd+Delete or right-click → Delete)

### Step 2: Commit the deletion

- [ ] Run:
```bash
git add -A
git commit -m "delete: remove landing page component"
```

**Expected output:** Git shows 1 file deleted with ~200 lines removed

---

## Task 3: Manual Testing - Verify Routes Work

**Files:**
- Test: App behavior (no file changes, just verification)

### Step 1: Start the frontend dev server

- [ ] Navigate to the frontend directory:
```bash
cd frontend
```

- [ ] Start the dev server:
```bash
npm start
```

**Expected output:** Browser opens to `http://localhost:3000`, you see the Auth page (login/registration form)

### Step 2: Verify unauthenticated users see Auth at /

- [ ] App should auto-open to `http://localhost:3000`
- [ ] You should see the **Auth page** (login/registration form with email/password fields)
- [ ] You should **NOT** see the Landing page (no hero section, pricing, features)

### Step 3: Verify /auth path no longer exists

- [ ] In the browser address bar, manually navigate to `http://localhost:3000/auth`
- [ ] Expected behavior: Should redirect to `http://localhost:3000/` OR show 404 (router will redirect to `/` since route doesn't exist)
- [ ] You should still see the Auth page

### Step 4: Verify authenticated user redirect works (if you have a test account)

- [ ] If you have valid credentials, log in on the Auth page
- [ ] After successful login, you should be redirected to `/dashboard`
- [ ] Try visiting `http://localhost:3000/` again
- [ ] You should be redirected to `/dashboard` (not stay on Auth page)

### Step 5: Check browser console for errors

- [ ] Open DevTools (F12 or right-click → Inspect)
- [ ] Go to the **Console** tab
- [ ] Verify no red errors appear related to routing or missing Landing component
- [ ] There may be warnings (OK), but no errors

### Step 6: Check that landing import error is gone

- [ ] In DevTools Console, you should **NOT** see an error like "Landing is not defined" or "Cannot import Landing"
- [ ] This confirms the import was successfully removed

---

## Task 4: Verify No Broken Imports in Test Files

**Files:**
- Check: `backend/tests/test_crewbook.py` (if it references Landing)

### Step 1: Search for Landing references in test files

- [ ] Run:
```bash
grep -r "Landing" frontend/src/
```

**Expected output:** No matches (or only in git history if you check `.git/`)

- [ ] If any matches appear outside of `pages/Landing.jsx`, update those references

### Step 2: Commit if changes were made

- [ ] If you found and fixed any stray references:
```bash
git add frontend/src/
git commit -m "fix: remove stray landing page references"
```

**Expected:** Either no output (no changes) or confirmation of fixed file

---

## Task 5: Final Verification

**Files:**
- Check: Overall app state

### Step 1: Stop and restart the dev server

- [ ] Stop the dev server (Ctrl+C in terminal)
- [ ] Restart it:
```bash
npm start
```

- [ ] Wait for it to compile and open browser

### Step 2: Do a fresh navigation test

- [ ] Browser should open to `/`
- [ ] You should see the **Auth page** (login/registration)
- [ ] No errors in console

### Step 3: Verify git log shows clean commits

- [ ] Run:
```bash
git log --oneline -5
```

**Expected output:** Last 2-3 commits include your Landing page removal and deletion commits:
```
abc123d delete: remove landing page component
def456e refactor: route auth page to root path, remove landing page route
ghi789f Add design spec: Remove landing page and make Auth first page
...
```

---

## Success Criteria Checklist

- [ ] Landing import removed from `frontend/src/App.js`
- [ ] Root route `/` renders Auth component
- [ ] `/auth` route is removed from App.js
- [ ] `frontend/src/pages/Landing.jsx` is deleted
- [ ] Unauthenticated users see Auth page at `/`
- [ ] No console errors in browser
- [ ] Authenticated users redirect to `/dashboard` as before
- [ ] All changes committed with clear messages
