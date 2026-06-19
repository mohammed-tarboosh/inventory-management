import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtNum } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { exportTablePDF } from "@/lib/pdf";
import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/movements")({ component: Page });

function Page() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [itemId, setItemId] = useState<string>("_");
  const [catId, setCatId] = useState<string>("_");

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => (await supabase.from("items").select("*").order("name_ar")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*")).data ?? [],
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", from, to, itemId, catId],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("*")
        .order("movement_date", { ascending: false });
      if (from) q = q.gte("movement_date", from);
      if (to) q = q.lte("movement_date", to);
      if (itemId !== "_") q = q.eq("item_id", itemId);
      const { data } = await q;
      let rows = data ?? [];
      if (catId !== "_") {
        const ids = new Set(
          (items as any[]).filter((i) => i.category_id === catId).map((i) => i.id),
        );
        rows = rows.filter((r: any) => ids.has(r.item_id));
      }
      return rows;
    },
  });

  const itemName = (id: string) =>
    (items as any[]).find((i) => i.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ?? "-";

  const exportXlsx = () =>
    exportToExcel(
      (movements as any[]).map((m) => ({
        date: m.movement_date,
        item: itemName(m.item_id),
        type: m.movement_type,
        qty: m.quantity,
        price: m.unit_price_local,
      })),
      "movements",
    );
  const exportPdf = () =>
    exportTablePDF({
      title: t("movements_report"),
      head: [t("date"), t("item"), t("movement_type"), t("quantity"), t("price_local")],
      body: (movements as any[]).map((m) => [
        fmtDate(m.movement_date),
        itemName(m.item_id),
        m.movement_type,
        m.quantity,
        m.unit_price_local,
      ]),
      filename: "movements",
    });

  return (
    <div>
      <PageHeader title={t("movements")}>
        <Button variant="outline" onClick={exportXlsx}>
          <Download className="h-4 w-4 me-1" />
          {t("export_excel")}
        </Button>
        <Button variant="outline" onClick={exportPdf}>
          <FileText className="h-4 w-4 me-1" />
          {t("export_pdf")}
        </Button>
      </PageHeader>
      <div className="grid grid-cols-1 gap-3 mb-4 p-4 bg-card border rounded-md sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>{t("from_date")}</Label>
          <DatePicker value={from} onValueChange={setFrom} />
        </div>
        <div>
          <Label>{t("to_date")}</Label>
          <DatePicker value={to} onValueChange={setTo} />
        </div>
        <div>
          <Label>{t("item")}</Label>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">{t("all")}</SelectItem>
              {(items as any[]).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("category")}</Label>
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">{t("all")}</SelectItem>
              {(categories as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable
        rows={movements as any[]}
        columns={[
          { key: "d", header: t("date"), cell: (r: any) => fmtDate(r.movement_date) },
          { key: "i", header: t("item"), cell: (r: any) => itemName(r.item_id) },
          { key: "t", header: t("movement_type"), cell: (r: any) => t(r.movement_type as any) },
          { key: "q", header: t("quantity"), cell: (r: any) => fmtNum(r.quantity, 2) },
          { key: "p", header: t("price_local"), cell: (r: any) => fmtNum(r.unit_price_local, 2) },
        ]}
      />
    </div>
  );
}
