import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { exportToExcel, readExcelFile } from "@/lib/excel";
import { fmtNum } from "@/lib/format";
import { Plus, Pencil, Upload, Download } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/items")({ component: Page });

function Page() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => (await supabase.from("items").select("*").order("name_ar")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*")).data ?? [],
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*")).data ?? [],
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["item_stock"],
    queryFn: async () => (await supabase.from("stock_movements").select("item_id, quantity")).data ?? [],
  });

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock as any[]) m.set(s.item_id, (m.get(s.item_id) ?? 0) + Number(s.quantity));
    return m;
  }, [stock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items as any[];
    return (items as any[]).filter((i) =>
      [i.code, i.name_ar, i.name_en].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [items, search]);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["item_stock"] });
  };

  const catName = (id: string) => (categories as any[]).find((c) => c.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ?? "-";
  const unitName = (id: string) => (units as any[]).find((u) => u.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ?? "-";

  const handleExport = () => {
    exportToExcel(
      filtered.map((i: any) => ({
        code: i.code,
        name_ar: i.name_ar,
        name_en: i.name_en,
        category: catName(i.category_id),
        unit: unitName(i.unit_id),
        last_price: i.last_purchase_price_local,
        qty: stockMap.get(i.id) ?? 0,
      })),
      "items"
    );
  };

  return (
    <div>
      <PageHeader title={t("items")}>
        <Input className="w-48" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 me-1" />{t("export_excel")}</Button>
        {can("items.import") && <ImportButton categories={categories as any[]} units={units as any[]} onDone={refetch} />}
        {can("items.manage") && <ItemForm categories={categories as any[]} units={units as any[]} onDone={refetch} />}
      </PageHeader>
      <DataTable
        rows={filtered}
        columns={[
          { key: "code", header: t("code"), cell: (r: any) => r.code ?? "-" },
          { key: "name_ar", header: t("name_ar"), cell: (r: any) => r.name_ar },
          { key: "name_en", header: t("name_en"), cell: (r: any) => r.name_en ?? "-" },
          { key: "cat", header: t("category"), cell: (r: any) => catName(r.category_id) },
          { key: "unit", header: t("unit"), cell: (r: any) => unitName(r.unit_id) },
          { key: "qty", header: t("current_qty"), cell: (r: any) => fmtNum(stockMap.get(r.id) ?? 0, 2) },
          { key: "price", header: t("last_price"), cell: (r: any) => fmtNum(r.last_purchase_price_local, 2) },
          {
            key: "actions", header: t("actions"), className: "w-32",
            cell: (r: any) => can("items.manage") ? (
              <div className="flex gap-1">
                <ItemForm row={r} categories={categories as any[]} units={units as any[]} onDone={refetch} />
                <ConfirmDelete onConfirm={async () => {
                  const { error } = await supabase.from("items").delete().eq("id", r.id);
                  if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
                }} />
              </div>
            ) : null,
          },
        ]}
      />
    </div>
  );
}

function ItemForm({ row, categories, units, onDone }: { row?: any; categories: any[]; units: any[]; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(row?.code ?? "");
  const [name_ar, setNameAr] = useState(row?.name_ar ?? "");
  const [name_en, setNameEn] = useState(row?.name_en ?? "");
  const [category_id, setCategoryId] = useState<string | null>(row?.category_id ?? null);
  const [unit_id, setUnitId] = useState<string | null>(row?.unit_id ?? null);
  const [notes, setNotes] = useState(row?.notes ?? "");

  const submit = async () => {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { code: code || null, name_ar, name_en: name_en || null, category_id, unit_id, notes: notes || null };
    if (row) {
      payload.updated_by = u.user?.id;
      const { error } = await supabase.from("items").update(payload).eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = u.user?.id;
      const { error } = await supabase.from("items").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t("save_success"));
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button> : <Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{row ? t("edit") : t("add")} - {t("items")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("code")}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><Label>{t("name_ar")}</Label><Input value={name_ar} onChange={(e) => setNameAr(e.target.value)} /></div>
          <div><Label>{t("name_en")}</Label><Input value={name_en} onChange={(e) => setNameEn(e.target.value)} /></div>
          <div>
            <Label>{t("category")}</Label>
            <Select value={category_id ?? "_"} onValueChange={(v) => setCategoryId(v === "_" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("unit")}</Label>
            <Select value={unit_id ?? "_"} onValueChange={(v) => setUnitId(v === "_" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{t("notes")}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!name_ar}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportButton({ categories, units, onDone }: { categories: any[]; units: any[]; onDone: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await readExcelFile(file);
      const { data: u } = await supabase.auth.getUser();
      const findCat = (n: string) => categories.find((c) => [c.name_ar, c.name_en, c.id].includes(n))?.id ?? null;
      const findUnit = (n: string) => units.find((x) => [x.name_ar, x.name_en, x.id].includes(n))?.id ?? null;
      const payload = rows
        .filter((r: any) => r.name_ar)
        .map((r: any) => ({
          code: r.code ? String(r.code) : null,
          name_ar: String(r.name_ar),
          name_en: r.name_en ? String(r.name_en) : null,
          category_id: r.category ? findCat(String(r.category)) : null,
          unit_id: r.unit ? findUnit(String(r.unit)) : null,
          last_purchase_price_local: r.price ? Number(r.price) : 0,
          created_by: u.user?.id,
        }));
      if (!payload.length) { toast.error(t("import_help")); return; }
      const { error } = await supabase.from("items").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(t("rows_imported", { n: payload.length }));
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <Button variant="outline" onClick={() => ref.current?.click()} disabled={busy} title={t("import_help")}>
        <Upload className="h-4 w-4 me-1" />{t("import_excel")}
      </Button>
    </>
  );
}