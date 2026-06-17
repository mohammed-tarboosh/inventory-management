import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";

export function AppSidebar() {
  const { t, dir } = useI18n();
  const { can } = usePermissions();
  const path = useRouterState({ select: (r) => r.location.pathname });

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard"), perm: null as string | null },
    { to: "/items", icon: Package, label: t("items"), perm: "items.view" },
    { to: "/categories", icon: FolderTree, label: t("categories"), perm: "items.view" },
    { to: "/units", icon: Ruler, label: t("units"), perm: "settings.view" },
    { to: "/suppliers", icon: Truck, label: t("suppliers"), perm: "suppliers.view" },
    { to: "/customers", icon: UsersIcon, label: t("customers"), perm: "customers.view" },
    { to: "/invoices", icon: FileText, label: t("invoices"), perm: "invoices.view" },
    { to: "/movements", icon: Activity, label: t("movements"), perm: "items.view" },
    { to: "/debts", icon: Wallet, label: t("debts"), perm: "debts.view" },
    { to: "/reports", icon: BarChart3, label: t("reports"), perm: "reports.view" },
    { to: "/audit-logs", icon: ClipboardList, label: t("audit_logs"), perm: "system.admin" },
    { to: "/users", icon: Shield, label: t("users"), perm: "users.manage" },
    { to: "/settings", icon: Settings, label: t("settings"), perm: "settings.view" },
  ];

  return (
    <Sidebar side={dir === "rtl" ? "right" : "left"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("app_name")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((i) => !i.perm || can(i.perm))
                .map((i) => (
                  <SidebarMenuItem key={i.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={path === i.to || path.startsWith(i.to + "/")}
                    >
                      <Link to={i.to} className="flex items-center gap-2">
                        <i.icon className="h-4 w-4" />
                        <span>{i.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
