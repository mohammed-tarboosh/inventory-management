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

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { email, error: usernameError } = resolveAuthEmail(username);

    if (usernameError) {
      setLoading(false);
      toast.error(usernameError);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim(), full_name: fullName || username.trim() } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) {
      toast.error(t("signup_requires_email_confirm"));
      nav({ to: "/login" });
      return;
    }
    toast.success(t("save_success"));
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-1 text-center">{t("create_first_admin")}</h1>
        <p className="text-xs text-muted-foreground text-center mb-4">{t("first_user_admin")}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>{t("username")}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required pattern="[a-zA-Z0-9_.\-]+" minLength={2} />
          </div>
          <div>
            <Label>{t("full_name")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>{t("password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{t("sign_up")}</Button>
        </form>
        <div className="mt-4 text-center text-xs">
          <Link to="/login" className="underline">{t("login")}</Link>
        </div>
      </Card>
    </div>
  );
}