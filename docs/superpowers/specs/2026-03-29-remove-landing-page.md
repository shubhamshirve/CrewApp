---
name: Remove Landing Page
description: Eliminate marketing landing page and make Auth (Login & Registration) the first page users encounter
type: spec
---

# Remove Landing Page Design Spec

## Overview

Replace the marketing-focused Landing page with the Auth page as the primary entry point. Users will go directly to login/registration upon visiting the app, eliminating the intermediate step of a landing page with features and pricing.

## Current State

- **Landing page**: `frontend/src/pages/Landing.jsx` (~200 lines)
  - Marketing hero section with feature highlights
  - Pricing tiers (Base/Premium)
  - Social proof (5000+ crew, 12000+ gigs, 4.8★)
  - Multiple CTAs all directing to `/auth`
- **Routing**:
  - `/` → Landing page (unauthenticated users)
  - `/auth` → Auth page (login/registration)
- **Auth page**: `frontend/src/pages/Auth.jsx` (already exists)
  - Login and registration forms
  - Credential validation

## Desired State

- **Routing**:
  - `/` → Auth page (login/registration, unauthenticated users)
  - `/auth` → removed entirely
- **File deletion**: `frontend/src/pages/Landing.jsx`
- **User flow**: Unauthenticated users land directly on login/registration

## Implementation Details

### Changes to `frontend/src/App.js`

1. **Remove Landing import** (line 8)
   ```javascript
   // DELETE: import Landing from "@/pages/Landing";
   ```

2. **Update root route** (UserRoutes function, line 85)
   - Change from: `<Route path="/" element={!user ? <Landing /> : ...} />`
   - Change to: `<Route path="/" element={!user ? <Auth /> : ...} />`

3. **Remove /auth route** (UserRoutes function, line 86)
   - Delete the entire `/auth` route definition

### File Deletion

- Delete `frontend/src/pages/Landing.jsx`

## User Experience Impact

- **Unauthenticated users**:
  - Visiting `/` goes directly to login/registration page
  - Removes one click/page transition
  - Faster onboarding

- **Authenticated users**:
  - Visiting `/` still redirects to `/dashboard` (unchanged)
  - Visiting `/admin/dashboard` for admins (unchanged)

- **Broken links**:
  - Any external links to `/auth` will 404 (unlikely in early development)
  - Can be addressed with a redirect if needed later

## Technical Scope

- **Files modified**: 1 file (`frontend/src/App.js`)
- **Files deleted**: 1 file (`frontend/src/pages/Landing.jsx`)
- **Lines changed**: ~5 lines in App.js
- **No backend changes**: Purely frontend routing refactor
- **No data/database changes**: No migrations needed
- **No API changes**: No endpoint modifications

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Old bookmarks/links to `/auth` break | Low impact: app in development, users unlikely to have bookmarks |
| Landing page needed later | File can be restored from git history in seconds |
| Missing marketing context on signup | Auth page is self-contained signup flow; can add copy to Auth if needed |

## Testing

- Verify unauthenticated user visiting `/` sees Auth page
- Verify authenticated user visiting `/` redirects to `/dashboard`
- Verify admin visiting `/` redirects to `/admin/dashboard`
- Verify `/auth` route no longer exists (404 or redirect behavior)

## Success Criteria

✓ Landing page removed from routing
✓ Auth page displays at `/` for unauthenticated users
✓ `/auth` route is removed
✓ `Landing.jsx` file is deleted
✓ No console errors or broken navigation
✓ User flow is seamless (no blank pages or redirects)
