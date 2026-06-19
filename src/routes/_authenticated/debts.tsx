import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { fmtDate, fmtNum, todayStr } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { exportTablePDF } from "@/lib/pdf";
import { Plus, Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debts")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("_");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const { data: txs = [] } = useQuery({
    queryKey: ["debt_tx", customerId],
    queryFn: async () => {
      let q = supabase.from("debt_transactions").select("*").order("transaction_date");
      if (customerId !== "_") q = q.eq("customer_id", customerId);
      return (await q).data ?? [];
    },
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [],
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ["debt_tx"] });

  // Build statement with running balance (positive = customer owes us)
  const statement = useMemo(() => {
    let bal = 0;
    return (txs as any[]).map((tx) => {
      const sign = tx.transaction_type === "debit" ? 1 : -1;
      bal += sign * Number(tx.amount_local);
      return { ...tx, balance: bal };
    });
  }, [txs]);

  const totals = useMemo(() => {
    let d = 0,
      c = 0;
    for (const r of statement) {
      if (r.transaction_type === "debit") d += Number(r.amount_local);
      else c += Number(r.amount_local);
    }
    return { d, c, bal: d - c };
  }, [statement]);

  const customerName = (id: string) => (customers as any[]).find((c) => c.id === id)?.name ?? "-";

  const exportXlsx = () =>
    exportToExcel(
      statement.map((r) => ({
        date: r.transaction_date,
        customer: customerName(r.customer_id),
        type: r.transaction_type,
        amount: r.amount,
        currency: r.currency_code,
        amount_local: r.amount_local,
        balance: r.balance,
        ref: r.invoice_ref,
        notes: r.notes,
      })),
      "customer_statement",
    );

  const exportPdf = () =>
    exportTablePDF({
      title: t("customer_statement_report"),
      meta: customerId !== "_" ? [`${t("customers")}: ${customerName(customerId)}`] : [],
      head: [
        t("date"),
        t("customers"),
        t("transaction_type"),
        t("amount"),
        t("currency"),
        t("price_local"),
        t("balance"),
        t("invoice_ref"),
      ],
      body: statement.map((r) => [
        fmtDate(r.transaction_date),
        customerName(r.customer_id),
        r.transaction_type,
        r.amount,
        r.currency_code,
        r.amount_local,
        r.balance,
        r.invoice_ref ?? "-",
      ]),
      filename: "customer_statement",
    });

  return (
    <div>
      <PageHeader title={t("debts")}>
        <Button variant="outline" onClick={exportXlsx}>
          <Download className="h-4 w-4 me-1" />
          {t("export_excel")}
        </Button>
        <Button variant="outline" onClick={exportPdf}>
          <FileText className="h-4 w-4 me-1" />
          {t("export_pdf")}
        </Button>
        {can("debts.manage") && (
          <TxForm
            customers={customers as any[]}
            currencies={currencies as any[]}
            defaultCustomer={customerId !== "_" ? customerId : undefined}
            onDone={refetch}
          />
        )}
      </PageHeader>
      <div className="p-4 bg-card border rounded-md mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>{t("customers")}</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">{t("all")}</SelectItem>
              {(customers as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm space-y-1">
          <div>
            {t("total_debit")}: <strong>{fmtNum(totals.d, 2)}</strong>
          </div>
          <div>
            {t("total_credit")}: <strong>{fmtNum(totals.c, 2)}</strong>
          </div>
          <div>
            {t("balance")}: <strong>{fmtNum(totals.bal, 2)}</strong>
          </div>
        </div>
      </div>
      <DataTable
        rows={statement}
        columns={[
          { key: "d", header: t("date"), cell: (r: any) => fmtDate(r.transaction_date) },
          { key: "c", header: t("customers"), cell: (r: any) => customerName(r.customer_id) },
          {
            key: "t",
            header: t("transaction_type"),
            cell: (r: any) => (r.transaction_type === "debit" ? t("debit") : t("credit_d")),
          },
          {
            key: "a",
            header: t("amount"),
            cell: (r: any) => `${fmtNum(r.amount, 2)} ${r.currency_code}`,
          },
          { key: "al", header: t("price_local"), cell: (r: any) => fmtNum(r.amount_local, 2) },
          { key: "bal", header: t("balance"), cell: (r: any) => fmtNum(r.balance, 2) },
          { key: "ref", header: t("invoice_ref"), cell: (r: any) => r.invoice_ref ?? "-" },
          { key: "n", header: t("notes"), cell: (r: any) => r.notes ?? "-" },
        ]}
      />
    </div>
  );
}

function TxForm({
  customers,
  currencies,
  defaultCustomer,
  onDone,
}: {
  customers: any[];
  currencies: any[];
  defaultCustomer?: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const baseCur = currencies.find((c) => c.is_base)?.code ?? "YER";
  const [customer_id, setCustomer] = useState<string | null>(defaultCustomer ?? null);
  const [transaction_type, setType] = useState("debit");
  const [amount, setAmount] = useState<number>(0);
  const [currency_code, setCur] = useState(baseCur);
  const [exchange_rate, setRate] = useState(1);
  const [transaction_date, setDate] = useState(todayStr());
  const [invoice_ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!customer_id || !amount) {
      toast.error("invalid");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("debt_transactions").insert({
      customer_id,
      transaction_type,
      amount,
      currency_code,
      exchange_rate,
      amount_local: amount * exchange_rate,
      transaction_date,
      invoice_ref: invoice_ref || null,
      notes: notes || null,
      created_by: u.user?.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("save_success"));
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 me-1" />
          {t("new_customer_transaction")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("new_customer_transaction")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t("customers")}</Label>
            <Select value={customer_id ?? ""} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder={t("select")} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("transaction_type")}</Label>
            <Select value={transaction_type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">{t("debit")}</SelectItem>
                <SelectItem value="credit">{t("credit_d")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("date")}</Label>
            <DatePicker value={transaction_date} onValueChange={setDate} />
          </div>
          <div>
            <Label>{t("amount")}</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>{t("currency")}</Label>
            <Select
              value={currency_code}
              onValueChange={(v) => {
                setCur(v);
                if (v === baseCur) setRate(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code}
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
              disabled={currency_code === baseCur}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>{t("invoice_ref")}</Label>
            <Input value={invoice_ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
