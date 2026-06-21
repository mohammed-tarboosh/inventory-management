import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Languages, LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/permissions";
import { SidebarToggleButton } from "@/components/AppSidebar";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Lock, ShieldCheck } from "lucide-react";

export function AppHeader() {
  const { locale, setLocale, t } = useI18n();
  const nav = useNavigate();
  const { data: user } = useCurrentUser();
  return (
    <>
      <header className="h-14 flex items-center gap-2 border-b px-3 bg-card shrink-0">
        {/* زر فتح/إغلاق السايدبار */}
        <SidebarToggleButton />

        <div className="flex-1 min-w-0" />

        {/* تبديل اللغة */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 px-2 sm:px-3"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === "ar" ? "EN" : "ع"}</span>
        </Button>

        {/* صورة المستخدم + قائمة منسدلة */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors outline-none">
              <UserAvatar
                userId={user?.id}
                avatarUrl={user?.profile?.avatar_url}
                name={user?.profile?.full_name ?? user?.profile?.username}
                size="sm"
              />
              <span className="hidden sm:block text-sm font-medium text-foreground max-w-[8rem] truncate">
                {user?.profile?.full_name ?? user?.profile?.username}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal pb-1">
              <p className="font-medium text-sm">{user?.profile?.full_name ?? user?.profile?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => nav({ to: "/profile" })} className="gap-2">
              <User className="h-4 w-4" />
              {t("my_profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav({ to: "/profile" })} className="gap-2">
              <Lock className="h-4 w-4" />
              {t("change_password")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav({ to: "/profile" })} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("my_permissions")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

    </>
  );
}
