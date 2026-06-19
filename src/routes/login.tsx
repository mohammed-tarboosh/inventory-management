import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { resolveAuthEmail } from "@/lib/auth";
import { toast } from "sonner";
import { getOidcLoginUrl } from "@/lib/auth/replit-auth.server";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function ReplitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 3h8v6H3zM3 10h5v4H3zM3 15h8v6H3zM13 3h8v11h-8zM13 15h5v6h-5z" />
    </svg>
  );
}

function LoginPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [replitLoading, setReplitLoading] = useState(false);

  const handleReplitLogin = async () => {
    setReplitLoading(true);
    try {
      const { authUrl, codeVerifier, state, redirectUri } = await getOidcLoginUrl();
      sessionStorage.setItem("replit_pkce", JSON.stringify({ codeVerifier, state, redirectUri }));
      window.location.href = authUrl;
    } catch (err) {
      toast.error("Failed to start Replit login. Please try again.");
      setReplitLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { email, error: usernameError } = resolveAuthEmail(username);

    if (usernameError) {
      setLoading(false);
      toast.error(usernameError);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        toast.error(t("email_not_confirmed"));
        return;
      }
      toast.error(error.message || t("login_failed"));
      return;
    }
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">{t("app_name")}</h1>
          <p className="text-sm text-muted-foreground">{t("login")}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={handleReplitLogin}
          disabled={replitLoading}
        >
          <ReplitIcon />
          {replitLoading ? "Redirecting…" : "Sign in with Replit"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs text-muted-foreground">
            <span className="bg-card px-2">or</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="u">{t("username")}</Label>
            <Input
              id="u"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              pattern="[a-zA-Z0-9_.-]+"
            />
          </div>
          <div>
            <Label htmlFor="p">{t("password")}</Label>
            <Input
              id="p"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {t("sign_in")}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/signup" className="underline">
            {t("create_first_admin")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
