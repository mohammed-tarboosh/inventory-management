import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtInt, fmtNum } from "@/lib/format";
import { Package, FileText, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Stat({ icon: Icon, label, value }: any) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [items, invoices, customers, mv] = await Promise.all([
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase.from("purchase_invoices").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("stock_movements").select("quantity, unit_price_local"),
      ]);
      const stockValue = (mv.data ?? []).reduce(
        (s, r: any) => s + Number(r.quantity) * Number(r.unit_price_local),
        0,
      );
      return {
        items: items.count ?? 0,
        invoices: invoices.count ?? 0,
        customers: customers.count ?? 0,
        stockValue,
      };
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("welcome")}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Package} label={t("stats_items")} value={fmtInt(data?.items)} />
        <Stat icon={FileText} label={t("stats_invoices")} value={fmtInt(data?.invoices)} />
        <Stat icon={Users} label={t("stats_customers")} value={fmtInt(data?.customers)} />
        <Stat icon={Wallet} label={t("stats_stock_value")} value={fmtNum(data?.stockValue, 0)} />
      </div>
    </div>
  );
}
