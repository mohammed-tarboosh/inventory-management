import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { fmtNum, fmtDate, todayStr } from "@/lib/format";
import { exportTablePDF } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import { Plus, Eye, Printer, Trash2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["purchase_invoices"],
    queryFn: async () =>
      (
        await supabase
          .from("purchase_invoices")
          .select("*")
          .order("invoice_date", { ascending: false })
      ).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => (await supabase.from("items").select("*").order("name_ar")).data ?? [],
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [],
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
    qc.invalidateQueries({ queryKey: ["item_stock"] });
    qc.invalidateQueries({ queryKey: ["items"] });
  };

  const supplierName = (id: string) => (suppliers as any[]).find((s) => s.id === id)?.name ?? "-";

  return (
    <div>
      <PageHeader title={t("invoices")}>
        {can("invoices.manage") && (
          <InvoiceForm
            suppliers={suppliers as any[]}
            items={items as any[]}
            currencies={currencies as any[]}
            onDone={refetch}
            editing={editingInvoice}
            onCancelEdit={() => setEditingInvoice(null)}
          />
        )}
      </PageHeader>
      <DataTable
        rows={invoices}
        columns={[
          { key: "no", header: t("invoice_no"), cell: (r: any) => r.invoice_no },
          { key: "d", header: t("invoice_date"), cell: (r: any) => fmtDate(r.invoice_date) },
          { key: "sup", header: t("supplier"), cell: (r: any) => supplierName(r.supplier_id) },
          { key: "pay", header: t("payment_type"), cell: (r: any) => t(r.payment_type as any) },
          { key: "cur", header: t("currency"), cell: (r: any) => r.currency_code },
          {
            key: "tf",
            header: t("total") + " " + t("price_foreign"),
            cell: (r: any) => fmtNum(r.total_foreign, 2),
          },
          {
            key: "tl",
            header: t("total") + " " + t("price_local"),
            cell: (r: any) => fmtNum(r.total_local, 2),
          },
          {
            key: "actions",
            header: t("actions"),
            className: "w-40",
            cell: (r: any) => (
              <div className="flex gap-1">
                {can("invoices.manage") && (
                  <Button variant="ghost" size="icon" onClick={() => setEditingInvoice(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <InvoiceView invoice={r} suppliers={suppliers as any[]} items={items as any[]} />
                {can("invoices.manage") && (
                  <ConfirmDelete
                    onConfirm={async () => {
                      const { error } = await supabase
                        .from("purchase_invoices")
                        .delete()
                        .eq("id", r.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success(t("delete_success"));
                        refetch();
                      }
                    }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

type Line = { item_id: string | null; quantity: number; price_foreign: number; _uid?: string };
type LineError = { item_id?: string; quantity?: string };

function InvoiceForm({
  suppliers,
  items,
  currencies,
  onDone,
  editing,
  onCancelEdit,
}: {
  suppliers: any[];
  items: any[];
  currencies: any[];
  onDone: () => void;
  editing?: any | null;
  onCancelEdit?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [invoice_no, setNo] = useState("");
  const [invoice_date, setDate] = useState(todayStr());
  const [supplier_id, setSupplier] = useState<string | null>(null);
  const [payment_type, setPay] = useState("cash");
  const baseCur = currencies.find((c) => c.is_base)?.code ?? "YER";
  const [currency_code, setCur] = useState(baseCur);
  const [exchange_rate, setRate] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const genUid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [lines, setLines] = useState<Line[]>([
    { item_id: null, quantity: 1, price_foreign: 0, _uid: genUid() },
  ]);
  const [fieldErrors, setFieldErrors] = useState<{
    invoice_no?: string;
    supplier_id?: string;
    lines: LineError[];
  }>({ lines: [{}] });
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const isForeign = currency_code !== baseCur;

  const reset = () => {
    setNo("");
    setDate(todayStr());
    setSupplier(null);
    setPay("cash");
    setCur(baseCur);
    setRate(1);
    setNotes("");
    setLines([{ item_id: null, quantity: 1, price_foreign: 0, _uid: genUid() }]);
    setFieldErrors({ lines: [{}] });
  };

  useEffect(() => {
    if (!editing) {
      reset();
      return;
    }

    const load = async () => {
      setOpen(true);
      setNo(editing.invoice_no ?? "");
      setDate(editing.invoice_date ?? todayStr());
      setSupplier(editing.supplier_id ?? null);
      setPay(editing.payment_type ?? "cash");
      setCur(editing.currency_code ?? baseCur);
      setRate(editing.exchange_rate ?? 1);
      setNotes(editing.notes ?? "");
      const { data: existingLines, error } = await supabase
        .from("purchase_invoice_items")
        .select("*")
        .eq("invoice_id", editing.id)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error(error.message);
        setLines([{ item_id: null, quantity: 1, price_foreign: 0, _uid: genUid() }]);
        return;
      }
      setLines(
        (existingLines?.length ?? 0) > 0
          ? existingLines!.map((l: any) => ({
              item_id: l.item_id,
              quantity: Number(l.quantity),
              price_foreign: Number(l.price_foreign),
              _uid: l.id ?? genUid(),
            }))
          : [{ item_id: null, quantity: 1, price_foreign: 0, _uid: genUid() }],
      );
    };

    void load();
  }, [editing, baseCur]);

  const totals = useMemo(() => {
    let tf = 0,
      tl = 0;
    for (const l of lines) {
      const lf = Number(l.quantity) * Number(l.price_foreign);
      tf += lf;
      tl += lf * Number(exchange_rate || 1);
    }
    return { tf, tl };
  }, [lines, exchange_rate]);

  const submit = async () => {
    const nextErrors: { invoice_no?: string; supplier_id?: string; lines: LineError[] } = {
      lines: lines.map(() => ({})),
    };
    if (!invoice_no.trim()) nextErrors.invoice_no = "الحقل إجباري";
    if (!supplier_id) nextErrors.supplier_id = "الحقل إجباري";

    lines.forEach((line, index) => {
      if (!line.item_id)
        nextErrors.lines[index] = { ...nextErrors.lines[index], item_id: "الحقل إجباري" };
      if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) {
        nextErrors.lines[index] = { ...nextErrors.lines[index], quantity: "الحقل إجباري" };
      }
    });

    const hasErrors = Boolean(
      nextErrors.invoice_no ||
      nextErrors.supplier_id ||
      nextErrors.lines.some((lineError) => lineError.item_id || lineError.quantity),
    );
    if (hasErrors) {
      setFieldErrors(nextErrors);
      return;
    }

    const valid = lines.filter((l) => l.item_id && l.quantity > 0);
    const { data: u } = await supabase.auth.getUser();
    const itemsPayload = valid.map((l) => {
      const lf = Number(l.quantity) * Number(l.price_foreign);
      const ll = lf * Number(exchange_rate);
      return {
        item_id: l.item_id!,
        quantity: l.quantity,
        price_foreign: l.price_foreign,
        price_local: Number(l.price_foreign) * Number(exchange_rate),
        line_total_local: ll,
      };
    });

    if (editing?.id) {
      const { error } = await supabase
        .from("purchase_invoices")
        .update({
          invoice_no,
          invoice_date,
          supplier_id,
          payment_type,
          currency_code,
          exchange_rate,
          total_foreign: totals.tf,
          total_local: totals.tl,
          notes: notes || null,
          updated_by: u.user?.id,
        })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }

      const { error: deleteLinesError } = await supabase
        .from("purchase_invoice_items")
        .delete()
        .eq("invoice_id", editing.id);
      if (deleteLinesError) {
        toast.error(deleteLinesError.message);
        return;
      }

      const { error: insertLinesError } = await supabase
        .from("purchase_invoice_items")
        .insert(itemsPayload.map((item) => ({ ...item, invoice_id: editing.id })));
      if (insertLinesError) {
        toast.error(insertLinesError.message);
        return;
      }

      toast.success(t("edit_success"));
      reset();
      setOpen(false);
      onDone();
      if (onCancelEdit) onCancelEdit();
      return;
    }

    const { data: inv, error } = await supabase
      .from("purchase_invoices")
      .insert({
        invoice_no,
        invoice_date,
        supplier_id,
        payment_type,
        currency_code,
        exchange_rate,
        total_foreign: totals.tf,
        total_local: totals.tl,
        notes: notes || null,
        created_by: u.user?.id,
      })
      .select()
      .single();
    if (error || !inv) {
      toast.error(error?.message ?? "");
      return;
    }
    const { error: e2 } = await supabase
      .from("purchase_invoice_items")
      .insert(itemsPayload.map((item) => ({ ...item, invoice_id: inv.id })));
    if (e2) {
      toast.error(e2.message);
      return;
    }
    toast.success(t("save_success"));
    reset();
    setOpen(false);
    onDone();
  };

  const qc = useQueryClient();

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setFieldErrors((current) => {
      const nextLines = [...(current.lines ?? [])];
      nextLines[index] = {
        ...(nextLines[index] ?? {}),
        ...(patch.item_id !== undefined ? { item_id: undefined } : {}),
        ...(patch.quantity !== undefined ? { quantity: undefined } : {}),
      };
      return { ...current, lines: nextLines };
    });
  };

  const handleCurrencyChange = async (v: string) => {
    setCur(v);
    if (v === baseCur) {
      setRate(1);
      return;
    }
    const { data: latest, error } = await supabase
      .from("exchange_rates")
      .select("rate_to_base")
      .eq("currency_code", v)
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
      setRate(1);
    } else {
      setRate(latest?.rate_to_base ?? 1);
    }
  };

  function SupplierForm({
    open,
    onOpenChange,
    onCreated,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onCreated: (s: any) => void;
  }) {
    const { t } = useI18n();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [default_currency, setDefaultCurrency] = useState("_");
    const [default_payment_type, setDefaultPaymentType] = useState("cash");
    const { data: currencies = [] } = useQuery({
      queryKey: ["currencies"],
      queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [],
    });

    const submitSup = async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { name, phone: phone || null, notes: notes || null };
      payload.default_currency = default_currency === "_" ? null : default_currency || null;
      payload.default_payment_type = default_payment_type;
      if (u.user?.id) payload.created_by = u.user.id;
      const { data: created, error } = await supabase
        .from("suppliers")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("save_success"));
      onOpenChange(false);
      onCreated(created);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add_supplier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t("phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>{t("default_currency")}</Label>
              <Select value={default_currency} onValueChange={(v) => setDefaultCurrency(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">{t("none")}</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("default_payment_type")}</Label>
              <Select value={default_payment_type} onValueChange={(v) => setDefaultPaymentType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="credit">{t("credit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={submitSup} disabled={!name}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 me-1" />
          {t("new_invoice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("edit") : t("new_invoice")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>{t("invoice_no")}</Label>
            <Input
              value={invoice_no}
              onChange={(e) => {
                setNo(e.target.value);
                if (fieldErrors.invoice_no)
                  setFieldErrors((current) => ({ ...current, invoice_no: undefined }));
              }}
              className={cn(
                fieldErrors.invoice_no && "border-destructive focus-visible:ring-destructive",
              )}
              aria-invalid={!!fieldErrors.invoice_no}
            />
            {fieldErrors.invoice_no && (
              <p className="text-xs text-destructive">{fieldErrors.invoice_no}</p>
            )}
          </div>
          <div>
            <Label>{t("invoice_date")}</Label>
            <DatePicker value={invoice_date} onValueChange={setDate} />
          </div>
          <div>
            <Label>{t("supplier")}</Label>
            <Select
              value={supplier_id ?? "_"}
              onValueChange={async (v) => {
                if (v === "_add") {
                  setShowAddSupplier(true);
                  return;
                }
                const id = v === "_" ? null : v;
                setSupplier(id);
                if (fieldErrors.supplier_id)
                  setFieldErrors((current) => ({ ...current, supplier_id: undefined }));
                if (!id) return;
                const s = suppliers.find((x) => x.id === id);
                if (s) {
                  if (s.default_currency) await handleCurrencyChange(s.default_currency);
                  setPay(s.default_payment_type ?? "cash");
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  fieldErrors.supplier_id && "border-destructive focus:ring-destructive",
                )}
                aria-invalid={!!fieldErrors.supplier_id}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value="_add">+ {t("add_supplier")}</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.supplier_id && (
              <p className="text-xs text-destructive">{fieldErrors.supplier_id}</p>
            )}
            <SupplierForm
              open={showAddSupplier}
              onOpenChange={setShowAddSupplier}
              onCreated={(s) => {
                setSupplier(s.id);
                if (s.default_currency) void handleCurrencyChange(s.default_currency);
                setPay(s.default_payment_type ?? "cash");
              }}
            />
          </div>
          <div>
            <Label>{t("payment_type")}</Label>
            <Select value={payment_type} onValueChange={setPay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("cash")}</SelectItem>
                <SelectItem value="credit">{t("credit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("currency")}</Label>
            <Select value={currency_code} onValueChange={(v) => void handleCurrencyChange(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("exchange_rate")}</Label>
            <Input
              type="number"
              step="0.0001"
              value={exchange_rate}
              disabled={!isForeign}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border rounded-md p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{t("add_item")}</strong>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setLines([
                  ...lines,
                  { item_id: null, quantity: 1, price_foreign: 0, _uid: genUid() },
                ])
              }
            >
              <Plus className="h-4 w-4 me-1" />
              {t("add")}
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
            const rowError = fieldErrors.lines[idx] ?? {};
            return (
              <div
                key={l._uid ?? idx}
                className="rounded-md border p-3 space-y-3 md:rounded-none md:border-0 md:p-0 md:grid md:grid-cols-12 md:gap-2 md:items-center"
              >
                <div className="space-y-1 md:col-span-5 md:space-y-0">
                  <Label className="text-xs md:hidden">{t("item")}</Label>
                  <Select
                    value={l.item_id ?? ""}
                    onValueChange={(v) => updateLine(idx, { item_id: v })}
                  >
                    <SelectTrigger
                      className={cn(
                        rowError.item_id && "border-destructive focus:ring-destructive",
                      )}
                      aria-invalid={!!rowError.item_id}
                    >
                      <SelectValue placeholder={t("select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name_ar}
                          {it.code ? ` (${it.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {rowError.item_id && (
                    <p className="text-xs text-destructive">{rowError.item_id}</p>
                  )}
                </div>
                <div className="space-y-1 md:col-span-2 md:space-y-0">
                  <Label className="text-xs md:hidden">{t("quantity")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                    className={cn(
                      rowError.quantity && "border-destructive focus-visible:ring-destructive",
                    )}
                    aria-invalid={!!rowError.quantity}
                  />
                  {rowError.quantity && (
                    <p className="text-xs text-destructive">{rowError.quantity}</p>
                  )}
                </div>
                <div className="space-y-1 md:col-span-2 md:space-y-0">
                  <Label className="text-xs md:hidden">
                    {isForeign ? t("price_foreign") : t("price_local")}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.price_foreign}
                    onChange={(e) => {
                      const n = [...lines];
                      n[idx] = { ...n[idx], price_foreign: Number(e.target.value) };
                      setLines(n);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between md:col-span-2 md:block">
                  <span className="text-xs font-medium text-muted-foreground md:hidden">
                    {t("line_total")}
                  </span>
                  <div className="text-sm">{fmtNum(lt, 2)}</div>
                </div>
                <div className="flex justify-end md:col-span-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-end gap-6 pt-2 border-t text-sm">
            <div>
              {t("total")} {currency_code}: <strong>{fmtNum(totals.tf, 2)}</strong>
            </div>
            <div>
              {t("total")} {baseCur}: <strong>{fmtNum(totals.tl, 2)}</strong>
            </div>
          </div>
        </div>

        <div>
          <Label>{t("notes")}</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              if (editing && onCancelEdit) onCancelEdit();
            }}
          >
            {t("cancel")}
          </Button>
          <Button onClick={submit}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceView({
  invoice,
  suppliers,
  items,
}: {
  invoice: any;
  suppliers: any[];
  items: any[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: lines = [] } = useQuery({
    queryKey: ["invoice_items", invoice.id, open],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("purchase_invoice_items").select("*").eq("invoice_id", invoice.id))
        .data ?? [],
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
      body: (lines as any[]).map((l) => [
        itemName(l.item_id),
        l.quantity,
        l.price_foreign,
        l.price_local,
        l.line_total_local,
      ]),
      filename: `invoice-${invoice.invoice_no}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t("invoice_details")} - {invoice.invoice_no}
          </DialogTitle>
        </DialogHeader>
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
          <Button variant="outline" onClick={print}>
            <Printer className="h-4 w-4 me-1" />
            {t("print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
