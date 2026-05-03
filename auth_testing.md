# Emergent Auth Testing Playbook (Google Social Login)

This file is the canonical testing playbook for Emergent-managed Google Auth integration in **Own Recovery**.

## Setup
- Backend session cookie name (Emergent flow): `session_token`
- Existing JWT email/password cookie (DO NOT BREAK): `or_token`
- Both cookies must coexist; auth helper checks `or_token` first, then `session_token`.
- MongoDB collections used: `users`, `user_sessions`

## Step 1 — Create Test User & Session via mongosh
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'user',
  auth_provider: 'google',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2 — Test backend API
```bash
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN"
```

## Step 3 — Regression checks (CRITICAL)
After Google Auth integration, retest:
1. Email/password login (`POST /api/auth/login`) still sets `or_token` and returns user.
2. Demo creds work after `POST /api/admin/reset-demo`:
   - `alex@demo.own / demo1234`
   - `sam@demo.own / demo1234`
   - `drquinn@demo.own / demo1234` (Clinician invite: `CLINICIAN-DEMO-2026`)
3. `/api/auth/me` returns user when only `or_token` is set.
4. `/api/auth/me` returns user when only `session_token` is set.
5. Role-based routing still works (Recovery user vs Clinician dashboard).
6. Logout clears both cookies safely.

## Frontend flow
1. User clicks "Continue with Google" → redirected to `https://auth.emergentagent.com/?redirect=<dashboard-url>`
2. Emergent returns user to `/dashboard#session_id=...`
3. AppRouter detects `session_id` synchronously during render → renders `<AuthCallback />`
4. AuthCallback POSTs `session_id` to `/api/auth/google/callback` (backend reads X-Session-ID and exchanges with `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`)
5. Backend creates/updates user, stores session in `user_sessions`, sets HttpOnly `session_token` cookie.
6. Frontend `navigate('/dashboard', { state: { user } })` and AuthContext skips `/me` race.

## Critical rules
- DO NOT hardcode redirect URL. Use `window.location.origin + '/dashboard'`.
- Existing email/password JWT auth (`or_token`) must remain fully functional.
- New Google users get role `user` by default; clinicians cannot self-elect role via Google login.
