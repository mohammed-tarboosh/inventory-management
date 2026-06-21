import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { LogOut, Settings2, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/lib/i18n";
import { usePermissions, useCurrentUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Truck,
  Users as UsersIcon,
  FileText,
  Activity,
  Wallet,
  BarChart3,
  Shield,
  Settings,
  Ruler,
  ClipboardList,
  X,
  ChevronRight,
  Menu,
} from "lucide-react";

// ─── hook: detect click outside ──────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// ─── context: share open state ────────────────────────────────────────────────
import { createContext, useContext } from "react";

type SidebarCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};
const SidebarContext = createContext<SidebarCtx>({ open: false, setOpen: () => {} });
export function useSidebarState() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ─── Trigger button (used in AppHeader) ──────────────────────────────────────
export function SidebarToggleButton() {
  const { open, setOpen } = useSidebarState();
  return (
    <button
      onClick={() => setOpen(!open)}
      className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

// ─── Nav items config ─────────────────────────────────────────────────────────
function useNavItems() {
  const { t } = useI18n();
  const { can } = usePermissions();

  const all = [
    { to: "/dashboard",        icon: LayoutDashboard, label: t("dashboard"),         perm: null as string | null, altPerm: null as string | null },
    { to: "/items",            icon: Package,         label: t("items"),             perm: "items.view",          altPerm: null },
    { to: "/categories",       icon: FolderTree,      label: t("categories"),        perm: "items.view",          altPerm: null },
    { to: "/units",            icon: Ruler,           label: t("units"),             perm: "settings.view",       altPerm: null },
    { to: "/suppliers",        icon: Truck,           label: t("suppliers"),         perm: "suppliers.view",      altPerm: null },
    { to: "/customers",        icon: UsersIcon,       label: t("customers"),         perm: "customers.view",      altPerm: null },
    { to: "/invoices",         icon: FileText,        label: t("invoices"),          perm: "invoices.view",       altPerm: null },
    { to: "/movements",        icon: Activity,        label: t("movements"),         perm: "items.view",          altPerm: null },
    { to: "/debts",            icon: Wallet,          label: t("debts"),             perm: "debts.view",          altPerm: null },
    { to: "/reports",          icon: BarChart3,       label: t("reports"),           perm: "reports.view",        altPerm: null },
    { to: "/audit-logs",       icon: ClipboardList,   label: t("audit_logs"),        perm: "system.admin",        altPerm: null },
    { to: "/users",            icon: Shield,          label: t("users"),             perm: "users.manage",        altPerm: "permissions.manage" },
    { to: "/permission-groups",icon: Shield,          label: t("permission_groups"), perm: "permissions.manage",  altPerm: null },
    { to: "/settings",         icon: Settings,        label: t("settings"),          perm: "settings.view",       altPerm: null },
    { to: "/profile",          icon: User,            label: t("my_profile"),        perm: null,                  altPerm: null },
  ];

  return all.filter((i) => !i.perm || can(i.perm) || (i.altPerm ? can(i.altPerm) : false));
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { open, setOpen } = useSidebarState();
  const isMobile = useIsMobile();
  const { t, dir } = useI18n();
  const { data: user } = useCurrentUser();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navItems = useNavItems();
  const drawerRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  };

  // إغلاق عند الضغط خارج السايدبار (موبايل)
  useClickOutside(drawerRef, () => {
    if (isMobile && open) setOpen(false);
  });

  // إغلاق تلقائي عند تغير الصفحة
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [pathname]);

  // منع scroll الصفحة عند فتح السايدبار على الموبايل
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = open ? "hidden" : "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  const isRtl = dir === "rtl";

  return (
    <>
      {/* Backdrop — موبايل فقط */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          )}
          aria-hidden
        />
      )}

      {/* السايدبار */}
      <aside
        ref={drawerRef}
        className={cn(
          // أساسيات
          "fixed z-50 top-0 bottom-0 flex flex-col",
          "w-72 bg-card border-border shadow-xl",
          "transition-transform duration-300 ease-in-out",
          // اتجاه RTL/LTR
          isRtl ? "right-0 border-l" : "left-0 border-r",
          // desktop: دائم ظاهر
          !isMobile && "md:translate-x-0",
          // desktop مخفي = مزاح للخارج
          !isMobile && !open && (isRtl ? "translate-x-full" : "-translate-x-full"),
          !isMobile && open && "translate-x-0",
          // موبايل
          isMobile && !open && (isRtl ? "translate-x-full" : "-translate-x-full"),
          isMobile && open && "translate-x-0",
        )}
      >
        {/* Header السايدبار */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {/* أيقونة التطبيق */}
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">
              {t("app_name")}
            </span>
          </div>
          {/* زر الإغلاق — موبايل */}
          {isMobile && (
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* معلومات المستخدم — قابل للضغط لفتح البروفايل */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <button
            onClick={() => { nav({ to: "/profile" }); setOpen(false); }}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-accent transition-colors group"
          >
            <UserAvatar
              userId={user?.id}
              avatarUrl={user?.profile?.avatar_url}
              name={user?.profile?.full_name ?? user?.profile?.username}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {user?.profile?.full_name ?? user?.profile?.username ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{user?.profile?.username ?? ""}
              </p>
            </div>
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
          </button>
        </div>

        {/* قائمة التنقل */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {active && (
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 opacity-70",
                      isRtl && "rotate-180",
                    )}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: تسجيل خروج + copyright */}
        <div className="px-3 py-2 border-t border-border shrink-0 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t("logout")}
          </button>
          <p className="text-[10px] text-muted-foreground/40 text-center pb-1">
            {t("app_name")} © {new Date().getFullYear()}
          </p>
        </div>
      </aside>


      {/* spacer للـ desktop حتى لا يتغطى المحتوى بالسايدبار */}
      {!isMobile && (
        <div
          className={cn(
            "shrink-0 transition-all duration-300",
            open ? "w-72" : "w-0",
          )}
        />
      )}
    </>
  );
}
