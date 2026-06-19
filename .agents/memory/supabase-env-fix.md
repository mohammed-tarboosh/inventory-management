---
name: Supabase env .env override issue
description: .env file has local Supabase values that override the correct production Replit env vars during Vite build
---

## Rule
The `.env` file in this project previously contained local Supabase values (`http://127.0.0.1:54321` URL and `sb_publishable_*` key). These MUST be kept in sync with the Replit shared env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

**Why:** The `.env` file values are loaded by Vite at dev/build time. Even though Replit shared env vars have the correct production values, if the `.env` file has wrong values they can interfere. The fix was to update `.env` with `https://arsqinmyguejjdxsddiq.supabase.co` and the real JWT anon key.

**How to apply:** If Supabase login stops working, check `.env` first. The values should match: `VITE_SUPABASE_URL=https://arsqinmyguejjdxsddiq.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY` = JWT starting with `eyJ`. Use `viewEnvVars({type:"env"})` in code_execution to read the correct values from Replit shared env vars and rewrite `.env`.

## Project details
- Supabase project: `arsqinmyguejjdxsddiq`
- Production URL: `https://arsqinmyguejjdxsddiq.supabase.co`
- Auth users: `admin@inv.local`, `oshaip@inv.local`, `alselwi@inv.local`, `salah@inv.local`
- Email format: `${username}@inv.local` (resolved in `src/lib/auth.ts`)
