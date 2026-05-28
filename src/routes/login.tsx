import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = `${username.trim().toLowerCase()}@inv.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t("login_failed"));
      return;
    }
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-1 text-center">{t("app_name")}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">{t("login")}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="u">{t("username")}</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="p">{t("password")}</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{t("sign_in")}</Button>
        </form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/signup" className="underline">{t("create_first_admin")}</Link>
        </div>
      </Card>
    </div>
  );
}