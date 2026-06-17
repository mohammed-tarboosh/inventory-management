import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { usePermissions } from "@/lib/permissions";
import { useMemo, useState } from "react";
import type { Database, Json } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileLookup = Pick<ProfileRow, "id" | "username" | "full_name">;
type UserPermissionRow = Database["public"]["Tables"]["user_permissions"]["Row"];
type UserPermissionGroupRow = Database["public"]["Tables"]["user_permission_groups"]["Row"];
type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];
type PermissionLabel = Pick<PermissionRow, "key" | "label_ar" | "label_en">;
type PermissionGroupRow = Database["public"]["Tables"]["permission_groups"]["Row"];
type PermissionGroupLabel = Pick<PermissionGroupRow, "id" | "name">;
type PermissionGroupItemRow = { permission_key: string };
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type AuditLogDiffChange = { field: string; old: Json; new: Json };
type AuditLogDiff = {
  changes?: AuditLogDiffChange[];
  after?: Record<string, Json>;
  before?: Record<string, Json>;
};
type AuditLogRowWithMetadata = AuditLogRow & {
  section: string;
  actor: string;
  changes: AuditLogDiffChange[];
  changeSummary: { field: string; old: string; new: string }[];
  rawAfter: Record<string, string>;
  rawBefore: Record<string, string>;
};

async function hasAdminAccess() {
  if (typeof window === "undefined") return false;

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return false;

  const permissions = new Set<string>();

  const { data: direct } = await supabase
    .from("user_permissions")
    .select("permission_key")
    .eq("user_id", userId);
  direct?.forEach((row) => permissions.add(row.permission_key));

  const { data: groupLinks } = await supabase
    .from("user_permission_groups")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = (groupLinks ?? []).map((row) => row.group_id);
  if (groupIds.length) {
    const { data: groupPerms } = await supabase
      .from("permission_group_items")
      .select("permission_key")
      .in("group_id", groupIds);
    groupPerms?.forEach((row) => permissions.add(row.permission_key));
  }

  return permissions.has("system.admin");
}

export const Route = createFileRoute("/_authenticated/audit-logs")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      throw redirect({ to: "/login" });
    }

    const allowed = await hasAdminAccess();
    if (!allowed) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const { isLoading: authLoading } = usePermissions();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: logs = [] } = useQuery<AuditLogRow[]>({
    queryKey: ["audit_logs"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("Failed to load audit logs:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery<ProfileLookup[]>({
    queryKey: ["audit_profiles"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,username,full_name");
      if (error) {
        console.error("Failed to load profiles:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const { data: permissions = [] } = useQuery<PermissionLabel[]>({
    queryKey: ["audit_permissions"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("key,label_ar,label_en");
      if (error) {
        console.error("Failed to load permissions:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const { data: permissionGroups = [] } = useQuery<PermissionGroupLabel[]>({
    queryKey: ["audit_permission_groups"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_groups")
        .select("id,name");
      if (error) {
        console.error("Failed to load permission groups:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const rows = useMemo<AuditLogRowWithMetadata[]>(() => {
    const profileMap = new Map(profiles.map((p) => [String(p.id), p]));
    const permissionLabelMap = new Map(
      permissions.map((p) => [p.key, locale === "ar" ? p.label_ar : p.label_en]),
    );
    const permissionGroupMap = new Map(permissionGroups.map((g) => [g.id, g.name]));

    const resolveActor = (...candidates: Array<Json | undefined>) => {
      for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        if (
          typeof candidate === "string" ||
          typeof candidate === "number" ||
          typeof candidate === "boolean"
        ) {
          const key = String(candidate);
          const profile = profileMap.get(key);
          if (profile) return profile.full_name || profile.username || key;
          return key;
        }
        if (typeof candidate === "object") {
          const key = JSON.stringify(candidate);
          if (key) return key;
        }
      }
      return "-";
    };

    const sectionLabel = (tableName: string) => {
      const map: Record<string, string> = {
        profiles: t("users"),
        permissions: t("permissions"),
        permission_groups: t("permissions"),
        permission_group_items: t("permissions"),
        user_permissions: t("permissions"),
        user_permission_groups: t("permissions"),
        currencies: t("settings"),
        exchange_rates: t("settings"),
        units: t("settings"),
        categories: t("categories"),
        items: t("items"),
        suppliers: t("suppliers"),
        customers: t("customers"),
        purchase_invoices: t("invoices"),
        purchase_invoice_items: t("invoices"),
        stock_movements: t("movements"),
        debt_transactions: t("debts"),
        audit_logs: t("reports"),
      };
      return map[tableName] ?? tableName;
    };

    const formatFieldValue = (value: Json | undefined, field?: string): string => {
      if (value === null || value === undefined) return "-";
      if (typeof value === "object") return JSON.stringify(value);
      const stringValue = String(value);
      if (field === "user_id" || field === "created_by" || field === "updated_by" || field === "changed_by") {
        const profile = profileMap.get(stringValue);
        return profile ? profile.full_name || profile.username || stringValue : stringValue;
      }
      if (field === "permission_key") {
        return permissionLabelMap.get(stringValue) ?? stringValue;
      }
      if (field === "group_id") {
        return permissionGroupMap.get(stringValue) ?? stringValue;
      }
      return stringValue;
    };

    const humanizeRecord = (record: Record<string, Json>) => {
      return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, formatFieldValue(value, key)]),
      );
    };

    return logs.map((log) => {
      const diff = (log.diff ?? {}) as AuditLogDiff;
      const changes = Array.isArray(diff.changes) ? diff.changes : [];
      const after = diff.after ?? {};
      const before = diff.before ?? {};
      return {
        ...log,
        section: sectionLabel(log.table_name),
        actor: resolveActor(after.updated_by, after.created_by, log.changed_by),
        changes,
        changeSummary: changes.map((c) => ({
          field: c.field,
          old: formatFieldValue(c.old, c.field),
          new: formatFieldValue(c.new, c.field),
        })),
        rawAfter: humanizeRecord(after),
        rawBefore: humanizeRecord(before),
      };
    });
  }, [logs, profiles, permissions, permissionGroups, locale, t]);

  const filterOptions = useMemo(() => {
    const uniqueTables = Array.from(new Set(rows.map((row) => row.table_name))).filter(
      Boolean,
    ) as string[];
    const uniqueActors = Array.from(new Set(rows.map((row) => row.actor))).filter(
      (value) => value && value !== "-",
    ) as string[];
    return { uniqueTables, uniqueActors };
  }, [rows]);

  const filteredRows = useMemo<AuditLogRowWithMetadata[]>(() => {
    return rows.filter((row) => {
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (tableFilter !== "all" && row.table_name !== tableFilter) return false;
      if (actorFilter !== "all" && row.actor !== actorFilter) return false;
      if (fromDate && new Date(row.changed_at) < new Date(fromDate)) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(row.changed_at) > end) return false;
      }
      return true;
    });
  }, [rows, actionFilter, tableFilter, actorFilter, fromDate, toDate]);

  return (
    <div>
      <PageHeader title={t("audit_logs")} />
      <div className="mb-4 rounded-md border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div>
            <Label>{t("operation")}</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="insert">{t("add")}</SelectItem>
                <SelectItem value="update">{t("edit")}</SelectItem>
                <SelectItem value="delete">{t("delete")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("table_name")}</Label>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {filterOptions.uniqueTables.map((tableName) => (
                  <SelectItem key={tableName} value={tableName}>
                    {tableName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("changed_by")}</Label>
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {filterOptions.uniqueActors.map((actor) => (
                  <SelectItem key={actor} value={actor}>
                    {actor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("from_date")}</Label>
            <DatePicker value={fromDate} onValueChange={setFromDate} />
          </div>
          <div>
            <Label>{t("to_date")}</Label>
            <DatePicker value={toDate} onValueChange={setToDate} />
          </div>
        </div>
      </div>
      <DataTable
        rows={filteredRows}
        columns={[
          {
            key: "changed_at",
            header: t("changed_at"),
            cell: (r: AuditLogRowWithMetadata) => fmtDateTime(r.changed_at),
          },
          {
            key: "action",
            header: t("operation"),
            cell: (r: AuditLogRowWithMetadata) => (
              <Badge
                variant={
                  r.action === "delete"
                    ? "destructive"
                    : r.action === "update"
                      ? "secondary"
                      : "default"
                }
              >
                {r.action === "insert" ? t("add") : r.action === "update" ? t("edit") : t("delete")}
              </Badge>
            ),
          },
          {
            key: "section",
            header: t("page_section"),
            cell: (r: AuditLogRowWithMetadata) => r.section,
          },
          {
            key: "table_name",
            header: t("table_name"),
            cell: (r: AuditLogRowWithMetadata) => r.table_name,
          },
          {
            key: "actor",
            header: t("changed_by"),
            cell: (r: AuditLogRowWithMetadata) => r.actor,
          },
          {
            key: "record_id",
            header: t("record"),
            cell: (r: AuditLogRowWithMetadata) => r.record_id ?? "-",
          },
          {
            key: "changes",
            header: t("details"),
            cell: (r: AuditLogRowWithMetadata) => {
              // For updates: show per-field previous/new pairs
              if (r.action === "update" && r.changeSummary?.length) {
                return (
                  <div className="space-y-2 max-w-lg">
                    {r.changeSummary.map((c) => (
                      <div
                        key={c.field}
                        className="rounded border bg-background px-2 py-1 text-xs space-y-1"
                      >
                        <div className="font-medium">{c.field}</div>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          <div>
                            <div className="text-muted-foreground">{t("previous_value")}</div>
                            <div className="break-all">{c.old}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">{t("new_value")}</div>
                            <div className="break-all">{c.new}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              // For inserts: show the inserted object
              if (r.action === "insert" && r.rawAfter && Object.keys(r.rawAfter).length) {
                return (
                  <pre className="rounded border bg-background p-2 text-xs overflow-auto max-w-160">
                    {JSON.stringify(r.rawAfter, null, 2)}
                  </pre>
                );
              }

              // For deletes: show the removed object
              if (r.action === "delete" && r.rawBefore && Object.keys(r.rawBefore).length) {
                return (
                  <pre className="rounded border bg-background p-2 text-xs overflow-auto max-w-160">
                    {JSON.stringify(r.rawBefore, null, 2)}
                  </pre>
                );
              }

              return <div className="text-sm text-muted-foreground">-</div>;
            },
          },
        ]}
      />
    </div>
  );
}
