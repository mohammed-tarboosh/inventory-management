import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Languages, LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/permissions";

export function AppHeader() {
  const { locale, setLocale, t } = useI18n();
  const nav = useNavigate();
  const { data: user } = useCurrentUser();

  return (
    <header className="h-14 flex items-center gap-2 border-b px-3 bg-card">
      <SidebarTrigger />
      <div className="flex-1" />
      <span className="text-sm text-muted-foreground hidden sm:inline">
        {user?.profile?.full_name ?? user?.profile?.username}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
        <Languages className="h-4 w-4 me-1" />
        {locale === "ar" ? "EN" : "ع"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await supabase.auth.signOut();
          nav({ to: "/login" });
        }}
      >
        <LogOut className="h-4 w-4 me-1" />
        {t("logout")}
      </Button>
    </header>
  );
}