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
import { fmtNum, fmtDate, todayStr } from "@/lib/format";
import { exportTablePDF } from "@/lib/pdf";
import { Plus, Eye, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase_invoices"],
    queryFn: async () => (await supabase.from("purchase_invoices").select("*").order("invoice_date", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await supabase.from("suppliers").select("*")).data ?? [] });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: async () => (await supabase.from("items").select("*").order("name_ar")).data ?? [] });
  const { data: currencies = [] } = useQuery({ queryKey: ["currencies"], queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [] });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
    qc.invalidateQueries({ queryKey: ["item_stock"] });
    qc.invalidateQueries({ queryKey: ["items"] });
  };

  const supplierName = (id: string) => (suppliers as any[]).find((s) => s.id === id)?.name ?? "-";

  return (
    <div>
      <PageHeader title={t("invoices")}>
        {can("invoices.manage") && <InvoiceForm suppliers={suppliers as any[]} items={items as any[]} currencies={currencies as any[]} onDone={refetch} />}
      </PageHeader>
      <DataTable
        rows={invoices}
        columns={[
          { key: "no", header: t("invoice_no"), cell: (r: any) => r.invoice_no },
          { key: "d", header: t("invoice_date"), cell: (r: any) => fmtDate(r.invoice_date) },
          { key: "sup", header: t("supplier"), cell: (r: any) => supplierName(r.supplier_id) },
          { key: "pay", header: t("payment_type"), cell: (r: any) => t(r.payment_type as any) },
          { key: "cur", header: t("currency"), cell: (r: any) => r.currency_code },
          { key: "tf", header: t("total") + " " + t("price_foreign"), cell: (r: any) => fmtNum(r.total_foreign, 2) },
          { key: "tl", header: t("total") + " " + t("price_local"), cell: (r: any) => fmtNum(r.total_local, 2) },
          {
            key: "actions", header: t("actions"), className: "w-40",
            cell: (r: any) => (
              <div className="flex gap-1">
                <InvoiceView invoice={r} suppliers={suppliers as any[]} items={items as any[]} />
                {can("invoices.manage") && (
                  <ConfirmDelete onConfirm={async () => {
                    const { error } = await supabase.from("purchase_invoices").delete().eq("id", r.id);
                    if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
                  }} />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

type Line = { item_id: string | null; quantity: number; price_foreign: number };

function InvoiceForm({ suppliers, items, currencies, onDone }: { suppliers: any[]; items: any[]; currencies: any[]; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [invoice_no, setNo] = useState("");
  const [invoice_date, setDate] = useState(todayStr());
  const [supplier_id, setSupplier] = useState<string | null>(null);
  const [payment_type, setPay] = useState("cash");
  const baseCur = (currencies.find((c) => c.is_base)?.code) ?? "YER";
  const [currency_code, setCur] = useState(baseCur);
  const [exchange_rate, setRate] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: null, quantity: 1, price_foreign: 0 }]);

  const isForeign = currency_code !== baseCur;

  const totals = useMemo(() => {
    let tf = 0, tl = 0;
    for (const l of lines) {
      const lf = Number(l.quantity) * Number(l.price_foreign);
      tf += lf;
      tl += lf * Number(exchange_rate || 1);
    }
    return { tf, tl };
  }, [lines, exchange_rate]);

  const reset = () => {
    setNo(""); setDate(todayStr()); setSupplier(null); setPay("cash");
    setCur(baseCur); setRate(1); setNotes(""); setLines([{ item_id: null, quantity: 1, price_foreign: 0 }]);
  };

  const submit = async () => {
    const valid = lines.filter((l) => l.item_id && l.quantity > 0);
    if (!invoice_no || !valid.length) { toast.error("invalid"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { data: inv, error } = await supabase
      .from("purchase_invoices")
      .insert({
        invoice_no, invoice_date, supplier_id, payment_type,
        currency_code, exchange_rate,
        total_foreign: totals.tf, total_local: totals.tl,
        notes: notes || null, created_by: u.user?.id,
      })
      .select()
      .single();
    if (error || !inv) { toast.error(error?.message ?? ""); return; }
    const itemsPayload = valid.map((l) => {
      const lf = Number(l.quantity) * Number(l.price_foreign);
      const ll = lf * Number(exchange_rate);
      return {
        invoice_id: inv.id,
        item_id: l.item_id!,
        quantity: l.quantity,
        price_foreign: l.price_foreign,
        price_local: Number(l.price_foreign) * Number(exchange_rate),
        line_total_local: ll,
      };
    });
    const { error: e2 } = await supabase.from("purchase_invoice_items").insert(itemsPayload);
    if (e2) { toast.error(e2.message); return; }
    toast.success(t("save_success"));
    reset(); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t("new_invoice")}</Button></DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl">
        <DialogHeader><DialogTitle>{t("new_invoice")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><Label>{t("invoice_no")}</Label><Input value={invoice_no} onChange={(e) => setNo(e.target.value)} /></div>
          <div><Label>{t("invoice_date")}</Label><Input type="date" value={invoice_date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>{t("supplier")}</Label>
            <Select value={supplier_id ?? "_"} onValueChange={(v) => setSupplier(v === "_" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("payment_type")}</Label>
            <Select value={payment_type} onValueChange={setPay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("cash")}</SelectItem>
                <SelectItem value="credit">{t("credit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("currency")}</Label>
            <Select value={currency_code} onValueChange={(v) => { setCur(v); if (v === baseCur) setRate(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("exchange_rate")}</Label><Input type="number" step="0.0001" value={exchange_rate} disabled={!isForeign} onChange={(e) => setRate(Number(e.target.value))} /></div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{t("add_item")}</strong>
            <Button size="sm" variant="outline" onClick={() => setLines([...lines, { item_id: null, quantity: 1, price_foreign: 0 }])}>
              <Plus className="h-4 w-4 me-1" />{t("add")}
            </Button>
          </div>
          <div className="hidden grid-cols-12 gap-2 text-sm font-semibold text-muted-foreground md:grid">
            <div className="col-span-5">{t("item")}</div>
            <div className="col-span-2">{t("quantity")}</div>
            <div className="col-span-2">{isForeign ? t("price_foreign") : t("price_local")}</div>
            <div className="col-span-2">{t("line_total")}</div>
            <div className="col-span-1"></div>
          </div>
          {lines.map((l, idx) => {
            const lt = Number(l.quantity) * Number(l.price_foreign);
            return (
              <div key={idx} className="rounded-md border p-3 space-y-3 md:rounded-none md:border-0 md:p-0 md:grid md:grid-cols-12 md:gap-2 md:items-center">
                <div className="space-y-1 md:col-span-5 md:space-y-0">
                  <Label className="text-xs md:hidden">{t("item")}</Label>
                  <Select value={l.item_id ?? ""} onValueChange={(v) => { const n = [...lines]; n[idx] = { ...n[idx], item_id: v }; setLines(n); }}>
                    <SelectTrigger><SelectValue placeholder={t("select")} /></SelectTrigger>
                    <SelectContent>
                      {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name_ar}{it.code ? ` (${it.code})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2 md:space-y-0">
                  <Label className="text-xs md:hidden">{t("quantity")}</Label>
                  <Input type="number" step="0.01" value={l.quantity} onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], quantity: Number(e.target.value) }; setLines(n); }} />
                </div>
                <div className="space-y-1 md:col-span-2 md:space-y-0">
                  <Label className="text-xs md:hidden">{isForeign ? t("price_foreign") : t("price_local")}</Label>
                  <Input type="number" step="0.01" value={l.price_foreign} onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], price_foreign: Number(e.target.value) }; setLines(n); }} />
                </div>
                <div className="flex items-center justify-between md:col-span-2 md:block">
                  <span className="text-xs font-medium text-muted-foreground md:hidden">{t("line_total")}</span>
                  <div className="text-sm">{fmtNum(lt, 2)}</div>
                </div>
                <div className="flex justify-end md:col-span-1">
                  <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-end gap-6 pt-2 border-t text-sm">
            <div>{t("total")} {currency_code}: <strong>{fmtNum(totals.tf, 2)}</strong></div>
            <div>{t("total")} {baseCur}: <strong>{fmtNum(totals.tl, 2)}</strong></div>
          </div>
        </div>

        <div><Label>{t("notes")}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceView({ invoice, suppliers, items }: { invoice: any; suppliers: any[]; items: any[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: lines = [] } = useQuery({
    queryKey: ["invoice_items", invoice.id, open],
    enabled: open,
    queryFn: async () => (await supabase.from("purchase_invoice_items").select("*").eq("invoice_id", invoice.id)).data ?? [],
  });
  const itemName = (id: string) => items.find((i) => i.id === id)?.name_ar ?? id;

  const print = () => {
    exportTablePDF({
      title: `${t("invoice_no")}: ${invoice.invoice_no}`,
      meta: [
        `${t("invoice_date")}: ${fmtDate(invoice.invoice_date)}`,
        `${t("supplier")}: ${suppliers.find((s) => s.id === invoice.supplier_id)?.name ?? "-"}`,
        `${t("currency")}: ${invoice.currency_code}   ${t("exchange_rate")}: ${invoice.exchange_rate}`,
      ],
      head: [t("item"), t("quantity"), t("price_foreign"), t("price_local"), t("line_total")],
      body: (lines as any[]).map((l) => [itemName(l.item_id), l.quantity, l.price_foreign, l.price_local, l.line_total_local]),
      filename: `invoice-${invoice.invoice_no}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{t("invoice_details")} - {invoice.invoice_no}</DialogTitle></DialogHeader>
        <DataTable
          rows={lines as any[]}
          columns={[
            { key: "i", header: t("item"), cell: (l: any) => itemName(l.item_id) },
            { key: "q", header: t("quantity"), cell: (l: any) => fmtNum(l.quantity, 2) },
            { key: "pf", header: t("price_foreign"), cell: (l: any) => fmtNum(l.price_foreign, 2) },
            { key: "pl", header: t("price_local"), cell: (l: any) => fmtNum(l.price_local, 2) },
            { key: "lt", header: t("line_total"), cell: (l: any) => fmtNum(l.line_total_local, 2) },
          ]}
        />
        <DialogFooter>
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4 me-1" />{t("print")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}