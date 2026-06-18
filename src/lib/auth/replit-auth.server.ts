import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import * as oidc from "openid-client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import memoizee from "memoizee";

// Cache OIDC discovery (refreshes every hour)
const getOidcConfig = memoizee(
  async () => {
    return await oidc.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000, promise: true }
);

// Derive a deterministic Supabase email + password from a Replit sub claim.
// This lets us maintain a Supabase session (needed for all data queries)
// while using Replit as the identity provider.
async function deriveSupabaseCredentials(sub: string) {
  const secret = process.env.SESSION_SECRET ?? "fallback-secret-change-me";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sub));
  const password = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const safeId = sub.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
  const email = `replit_${safeId}@replit.auth`;
  return { email, password };
}

// ── Step 1: Generate the OIDC authorization URL + PKCE params ──────────────
// Called from the login page. Returns the URL to redirect the user to,
// plus the code_verifier and state the client must store in sessionStorage
// so Step 2 can verify them.
export const getOidcLoginUrl = createServerFn({ method: "GET" }).handler(async () => {
  // Detect the app's public hostname from the actual request so this works
  // in both dev (*.replit.dev) and production (*.replit.app) automatically.
  const request = getWebRequest();
  const hostname = request
    ? new URL(request.url).hostname
    : (process.env.REPLIT_DEV_DOMAIN ?? "localhost");

  const protocol = hostname === "localhost" ? "http" : "https";
  const redirectUri = `${protocol}://${hostname}/replit-callback`;
  const config = await getOidcConfig();

  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();

  const authUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return { authUrl: authUrl.href, codeVerifier, state, redirectUri };
});

// ── Step 2: Exchange the authorization code for a Supabase session ─────────
// Called from /replit-callback after Replit redirects back.
// Verifies state, exchanges the OIDC code, then signs the user into Supabase
// (auto-creating an account if this is their first login).
export const exchangeOidcCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string(),
      state: z.string(),
      savedState: z.string(),
      codeVerifier: z.string(),
      redirectUri: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { code, state, savedState, codeVerifier, redirectUri } = data;

    if (state !== savedState) {
      throw new Error("State mismatch — possible CSRF. Please try logging in again.");
    }

    const config = await getOidcConfig();

    // Build a synthetic Request so openid-client can parse the callback params
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    let tokens: oidc.TokenEndpointResponse;
    try {
      tokens = await oidc.authorizationCodeGrant(config, new Request(callbackUrl.href), {
        pkceCodeVerifier: codeVerifier,
        expectedState: savedState,
        redirectUri,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OIDC token exchange failed: ${msg}`);
    }

    const claims = tokens.claims();
    if (!claims?.sub) throw new Error("No user identity returned from Replit.");

    const { email, password } = await deriveSupabaseCredentials(claims.sub);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Try sign-in first; auto-create account on first Replit login
    const signIn = await supabase.auth.signInWithPassword({ email, password });

    if (!signIn.error && signIn.data.session) {
      return {
        accessToken: signIn.data.session.access_token,
        refreshToken: signIn.data.session.refresh_token,
      };
    }

    // First-time login: create a Supabase account for this Replit user
    const displayName = String(
      (claims as any).first_name ?? (claims as any).name ?? "Replit User"
    );
    const username = `replit_${(claims.sub as string).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;

    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: displayName } },
    });

    if (signUp.error || !signUp.data.session) {
      throw new Error(
        `Failed to create account: ${signUp.error?.message ?? "no session returned"}. ` +
        "Please contact an administrator."
      );
    }

    return {
      accessToken: signUp.data.session.access_token,
      refreshToken: signUp.data.session.refresh_token,
    };
  });
