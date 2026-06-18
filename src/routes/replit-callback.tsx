import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exchangeOidcCode } from "@/lib/auth/replit-auth.server";
import { toast } from "sonner";

export const Route = createFileRoute("/replit-callback")({
  component: ReplitCallbackPage,
});

function ReplitCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const errorParam = params.get("error");
    const errorDesc = params.get("error_description");

    if (errorParam) {
      setError(errorDesc ?? errorParam);
      return;
    }

    if (!code || !state) {
      navigate({ to: "/login" });
      return;
    }

    const stored = sessionStorage.getItem("replit_pkce");
    if (!stored) {
      setError("Login session expired. Please try again.");
      return;
    }

    let codeVerifier: string;
    let savedState: string;
    let redirectUri: string;

    try {
      const parsed = JSON.parse(stored);
      codeVerifier = parsed.codeVerifier;
      savedState = parsed.state;
      redirectUri = parsed.redirectUri;
    } catch {
      setError("Corrupted login session. Please try again.");
      return;
    }

    sessionStorage.removeItem("replit_pkce");

    exchangeOidcCode({
      data: { code, state, savedState, codeVerifier, redirectUri },
    })
      .then(async ({ accessToken, refreshToken }) => {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionErr) {
          setError(`Failed to establish session: ${sessionErr.message}`);
          return;
        }
        navigate({ to: "/dashboard" });
      })
      .catch((err: Error) => {
        setError(err.message);
        toast.error(err.message);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-destructive font-medium">Authentication failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="text-sm underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
