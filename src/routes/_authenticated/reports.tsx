import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtNum } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { exportTablePDF } from "@/lib/pdf";
import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({ component: Page });

function Page() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: async () => (await supabase.from("items").select("*")).data ?? [] });
  const { data: stock = [] } = useQuery({
    queryKey: ["mv_all", from, to],
    queryFn: async () => {
      let q = supabase.from("stock_movements").select("*");
      if (from) q = q.gte("movement_date", from);
      if (to) q = q.lte("movement_date", to);
      return (await q).data ?? [];
    },
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["inv_all", from, to],
    queryFn: async () => {
      let q = supabase.from("purchase_invoices").select("*");
      if (from) q = q.gte("invoice_date", from);
      if (to) q = q.lte("invoice_date", to);
      return (await q).data ?? [];
    },
  });

  const itemName = (id: string) => (items as any[]).find((i) => i.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ?? "-";

  const inventoryRows = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    for (const s of stock as any[]) {
      const cur = m.get(s.item_id) ?? { qty: 0, value: 0 };
      cur.qty += Number(s.quantity);
      cur.value += Number(s.quantity) * Number(s.unit_price_local);
      m.set(s.item_id, cur);
    }
    return (items as any[]).map((i) => ({
      item: itemName(i.id),
      qty: m.get(i.id)?.qty ?? 0,
      last_price: i.last_purchase_price_local,
      value: (m.get(i.id)?.qty ?? 0) * Number(i.last_purchase_price_local ?? 0),
    }));
  }, [items, stock, locale]);

  const totalInvoices = (invoices as any[]).reduce((s, i) => s + Number(i.total_local), 0);

  return (
    <div>
      <PageHeader title={t("reports")} />
      <div className="grid grid-cols-1 gap-3 mb-4 p-4 bg-card border rounded-md sm:grid-cols-2 lg:grid-cols-4">
        <div><Label>{t("from_date")}</Label><DatePicker value={from} onValueChange={setFrom} /></div>
        <div><Label>{t("to_date")}</Label><DatePicker value={to} onValueChange={setTo} /></div>
      </div>

      <h2 className="text-xl font-semibold mb-2 mt-6">{t("inventory_report")}</h2>
      <div className="flex gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => exportToExcel(inventoryRows, "inventory")}><Download className="h-4 w-4 me-1" />{t("export_excel")}</Button>
        <Button variant="outline" size="sm" onClick={() => exportTablePDF({
          title: t("inventory_report"),
          head: [t("item"), t("current_qty"), t("last_price"), t("stock_value")],
          body: inventoryRows.map((r) => [r.item, r.qty, r.last_price ?? 0, r.value]),
          filename: "inventory",
        })}><FileText className="h-4 w-4 me-1" />{t("export_pdf")}</Button>
      </div>
      <DataTable rows={inventoryRows} columns={[
        { key: "i", header: t("item"), cell: (r: any) => r.item },
        { key: "q", header: t("current_qty"), cell: (r: any) => fmtNum(r.qty, 2) },
        { key: "p", header: t("last_price"), cell: (r: any) => fmtNum(r.last_price, 2) },
        { key: "v", header: t("stock_value"), cell: (r: any) => fmtNum(r.value, 2) },
      ]} />

      <h2 className="text-xl font-semibold mb-2 mt-6">{t("purchases_report")}</h2>
      <div className="text-sm mb-2">{t("total")}: <strong>{fmtNum(totalInvoices, 2)}</strong></div>
      <DataTable rows={invoices as any[]} columns={[
        { key: "n", header: t("invoice_no"), cell: (r: any) => r.invoice_no },
        { key: "d", header: t("invoice_date"), cell: (r: any) => fmtDate(r.invoice_date) },
        { key: "c", header: t("currency"), cell: (r: any) => r.currency_code },
        { key: "t", header: t("total"), cell: (r: any) => fmtNum(r.total_local, 2) },
      ]} />
    </div>
  );
}