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
    <header className="min-h-14 flex flex-wrap items-center gap-2 border-b px-2 py-2 bg-card sm:px-3">
      <SidebarTrigger className="shrink-0" />
      <div className="flex-1 min-w-0" />
      <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground sm:inline">
        {user?.profile?.full_name ?? user?.profile?.username}
      </span>
      <Button variant="ghost" size="sm" className="shrink-0 gap-1 px-2 sm:px-3" onClick={() => setLocale(locale === "ar" ? "en" : "ar") }>
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{locale === "ar" ? "EN" : "ع"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1 px-2 sm:px-3"
        onClick={async () => {
          await supabase.auth.signOut();
          nav({ to: "/login" });
        }}
      >
        <LogOut className="h-4 w-4 me-1" />
        <span className="hidden sm:inline">{t("logout")}</span>
      </Button>
    </header>
  );
}