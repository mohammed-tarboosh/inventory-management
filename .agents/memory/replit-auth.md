---
name: Replit Auth architecture
description: How Replit Auth (OIDC) is wired into this TanStack Start + Supabase app.
---

## Context
TanStack Start v1.167 does **not** export `createAPIFileRoute` — there is no `@tanstack/react-start/api` subpath. API file routes (files exporting `APIRoute`) are warned about and silently dropped from the route tree.

## Solution: server functions as the auth boundary

All OIDC logic lives in `src/lib/auth/replit-auth.server.ts`:
- `getOidcLoginUrl` (GET server fn) — runs OIDC discovery, generates PKCE params, returns the authorization URL + verifier to the client.
- `exchangeOidcCode` (POST server fn) — verifies state, exchanges the code with Replit, then signs the user into Supabase (auto-creating account on first login).

**Why:** Server functions work as RPC over fetch and run server-side. No HTTP route primitives needed.

## PKCE flow
1. Client clicks "Sign in with Replit" → calls `getOidcLoginUrl()`.
2. Server returns `{ authUrl, codeVerifier, state, redirectUri }`.
3. Client stores `{ codeVerifier, state, redirectUri }` in `sessionStorage` key `replit_pkce`.
4. Client navigates to `authUrl`.
5. Replit redirects to `/replit-callback?code=...&state=...` (client-side TanStack route).
6. `/replit-callback` reads code/state from URL, reads PKCE from sessionStorage, calls `exchangeOidcCode()`.
7. Server exchanges code → signs into Supabase → returns `{ accessToken, refreshToken }`.
8. Client calls `supabase.auth.setSession({ access_token, refresh_token })` → navigates to `/dashboard`.

## Supabase bridge
Because all data queries use the client-side Supabase JS SDK (RLS-enforced), we must keep a Supabase session alive. After OIDC, we derive a deterministic `email` / `password` from the Replit `sub` claim (HMAC-SHA256 of SESSION_SECRET + sub), then sign in or auto-register the user in Supabase. Existing Supabase data queries are untouched.

**Why:** No SERVICE_ROLE_KEY is configured, so admin user creation isn't available. Client-side signInWithPassword + signUp works without it.

## Hostname detection
`getOidcLoginUrl` reads `getWebRequest().url` to detect the hostname dynamically (works for both `*.replit.dev` dev domain and `*.replit.app` production domain). Falls back to `REPLIT_DEV_DOMAIN` env var.
