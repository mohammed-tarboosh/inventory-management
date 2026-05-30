import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { usePermissions } from "@/lib/permissions";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/audit-logs")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { isLoading: authLoading } = usePermissions();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: logs = [] } = useQuery({
    queryKey: ["audit_logs"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];
      const response = await fetch(`${supabaseUrl}/rest/v1/audit_logs?select=*&order=changed_at.desc&limit=500`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok ? await response.json() : [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["audit_profiles"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];
      const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username,full_name`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok ? await response.json() : [];
    },
  });

  const rows = useMemo(() => {
    const profileMap = new Map((profiles as any[]).map((p) => [String(p.id), p]));
    const resolveActor = (...candidates: Array<string | null | undefined>) => {
      for (const candidate of candidates) {
        if (!candidate) continue;
        const key = String(candidate);
        const profile = profileMap.get(key);
        if (profile) return profile.full_name || profile.username || key;
      }
      return candidates.find((candidate) => !!candidate) ?? "-";
    };
    const sectionLabel = (tableName: string) => {
      const map: Record<string, string> = {
        profiles: t("users"),
        permissions: t("users"),
        permission_groups: t("users"),
        permission_group_items: t("users"),
        user_permissions: t("users"),
        user_permission_groups: t("users"),
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

    const formatValue = (value: any) => {
      if (value === null || value === undefined) return "-";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    return (logs as any[]).map((log) => {
      const diff = log.diff ?? {};
      const changes = Array.isArray(diff.changes) ? diff.changes : [];
      const after = diff.after ?? {};
      const before = diff.before ?? {};
      return {
        ...log,
        section: sectionLabel(log.table_name),
        actor: resolveActor(after.updated_by, after.created_by, log.changed_by),
        changes: changes,
        changeSummary: changes.map((c: any) => ({
          field: c.field,
          old: formatValue(c.old),
          new: formatValue(c.new),
        })),
        rawAfter: after,
        rawBefore: before,
      };
    });
  }, [logs, profiles, t]);

  const filterOptions = useMemo(() => {
    const uniqueTables = Array.from(new Set((rows as any[]).map((row) => row.table_name))).filter(Boolean);
    const uniqueActors = Array.from(new Set((rows as any[]).map((row) => row.actor))).filter((value) => value && value !== "-");
    return { uniqueTables, uniqueActors };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return (rows as any[]).filter((row) => {
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {filterOptions.uniqueTables.map((tableName) => (
                  <SelectItem key={tableName} value={tableName}>{tableName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("changed_by")}</Label>
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {filterOptions.uniqueActors.map((actor) => (
                  <SelectItem key={actor} value={actor}>{actor}</SelectItem>
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
        rows={filteredRows as any[]}
        columns={[
          { key: "changed_at", header: t("changed_at"), cell: (r: any) => fmtDateTime(r.changed_at) },
          {
            key: "action",
            header: t("operation"),
            cell: (r: any) => (
              <Badge variant={r.action === "delete" ? "destructive" : r.action === "update" ? "secondary" : "default"}>
                {r.action === "insert" ? t("add") : r.action === "update" ? t("edit") : t("delete")}
              </Badge>
            ),
          },
          { key: "section", header: t("page_section"), cell: (r: any) => r.section },
          { key: "table_name", header: t("table_name"), cell: (r: any) => r.table_name },
          { key: "actor", header: t("changed_by"), cell: (r: any) => r.actor },
          { key: "record_id", header: t("record"), cell: (r: any) => r.record_id ?? "-" },
          {
            key: "changes",
            header: t("details"),
            cell: (r: any) => {
              // For updates: show per-field previous/new pairs
              if (r.action === "update" && r.changeSummary?.length) {
                return (
                  <div className="space-y-2 max-w-[32rem]">
                    {r.changeSummary.map((c: any) => (
                      <div key={c.field} className="rounded border bg-background px-2 py-1 text-xs space-y-1">
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
                  <pre className="rounded border bg-background p-2 text-xs overflow-auto max-w-[40rem]">{JSON.stringify(r.rawAfter, null, 2)}</pre>
                );
              }

              // For deletes: show the removed object
              if (r.action === "delete" && r.rawBefore && Object.keys(r.rawBefore).length) {
                return (
                  <pre className="rounded border bg-background p-2 text-xs overflow-auto max-w-[40rem]">{JSON.stringify(r.rawBefore, null, 2)}</pre>
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
