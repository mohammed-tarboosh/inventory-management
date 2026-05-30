import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { fmtDate, fmtNum, todayStr } from "@/lib/format";
import { Plus, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  if (!can("settings.view")) return <PageHeader title={t("no_permission")} />;
  return (
    <div>
      <PageHeader title={t("settings")} />
      <Tabs defaultValue="currencies">
        <TabsList>
          <TabsTrigger value="currencies">{t("currencies")}</TabsTrigger>
          <TabsTrigger value="rates">{t("exchange_rates")}</TabsTrigger>
        </TabsList>
        <TabsContent value="currencies"><CurrenciesTab /></TabsContent>
        <TabsContent value="rates"><RatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CurrenciesTab() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["currencies"], queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [] });
  const refetch = () => qc.invalidateQueries({ queryKey: ["currencies"] });
  const [editingCurrency, setEditingCurrency] = useState<any | null>(null);
  return (
    <div className="space-y-3">
      {can("settings.manage") && <CurrencyForm onDone={refetch} editing={editingCurrency} onCancelEdit={() => setEditingCurrency(null)} />}
      <DataTable rows={rows as any[]} columns={[
        { key: "c", header: t("code"), cell: (r: any) => r.code },
        { key: "ar", header: t("name_ar"), cell: (r: any) => r.name_ar },
        { key: "en", header: t("name_en"), cell: (r: any) => r.name_en },
        { key: "s", header: "Symbol", cell: (r: any) => r.symbol },
        { key: "b", header: t("base_currency"), cell: (r: any) => r.is_base ? "✓" : "" },
        { key: "a", header: t("actions"), cell: (r: any) => can("settings.manage") && !r.is_base && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditingCurrency(r)}><Pencil className="h-4 w-4" /></Button>
            <ConfirmDelete onConfirm={async () => {
              const { error } = await supabase.from("currencies").delete().eq("code", r.code);
              if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
            }} />
          </div>
        ) },
      ]} />
    </div>
  );
}

function CurrencyForm({ onDone, editing, onCancelEdit }: { onDone: () => void; editing?: any | null; onCancelEdit?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(""); const [ar, setAr] = useState(""); const [en, setEn] = useState(""); const [sym, setSym] = useState("");

  // prefill when editing
  useEffect(() => {
    if (editing) {
      setCode(editing.code ?? "");
      setAr(editing.name_ar ?? "");
      setEn(editing.name_en ?? "");
      setSym(editing.symbol ?? "");
      setOpen(true);
    }
  }, [editing]);

  const submit = async () => {
    if (!code || !ar) return;
    if (editing && editing.code) {
      const { error } = await supabase.from("currencies").update({ code: code.toUpperCase(), name_ar: ar, name_en: en, symbol: sym }).eq("code", editing.code);
      if (error) return toast.error(error.message);
      toast.success(t("save_success")); setOpen(false); onDone(); if (onCancelEdit) onCancelEdit(); return;
    }
    const { error } = await supabase.from("currencies").insert({ code: code.toUpperCase(), name_ar: ar, name_en: en, symbol: sym, is_base: false });
    if (error) return toast.error(error.message);
    toast.success(t("save_success")); setOpen(false); onDone();
    setCode(""); setAr(""); setEn(""); setSym("");
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && editing && onCancelEdit) onCancelEdit(); }}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? t("edit") : t("currencies")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>{t("code")}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><Label>Symbol</Label><Input value={sym} onChange={(e) => setSym(e.target.value)} /></div>
          <div><Label>{t("name_ar")}</Label><Input value={ar} onChange={(e) => setAr(e.target.value)} /></div>
          <div><Label>{t("name_en")}</Label><Input value={en} onChange={(e) => setEn(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); if (editing && onCancelEdit) onCancelEdit(); }}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!code || !ar}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatesTab() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["rates"], queryFn: async () => (await supabase.from("exchange_rates").select("*").order("rate_date", { ascending: false })).data ?? [] });
  const { data: currencies = [] } = useQuery({ queryKey: ["currencies"], queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [] });
  const refetch = () => qc.invalidateQueries({ queryKey: ["rates"] });
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <div className="space-y-3">
      {can("settings.manage") && <RateForm currencies={currencies as any[]} onDone={refetch} editing={editing} onCancelEdit={() => setEditing(null)} />}
      <DataTable rows={rows as any[]} columns={[
        { key: "d", header: t("rate_date"), cell: (r: any) => fmtDate(r.rate_date) },
        { key: "c", header: t("currency"), cell: (r: any) => r.currency_code },
        { key: "r", header: t("exchange_rate"), cell: (r: any) => fmtNum(r.rate_to_base, 4) },
        { key: "a", header: t("actions"), cell: (r: any) => can("settings.manage") && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
            <ConfirmDelete onConfirm={async () => {
              const { error } = await supabase.from("exchange_rates").delete().eq("id", r.id);
              if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
            }} />
          </div>
        ) },
      ]} />
    </div>
  );
}

function RateForm({ currencies, onDone, editing, onCancelEdit }: { currencies: any[]; onDone: () => void; editing?: any | null; onCancelEdit?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [currency_code, setCur] = useState("");
  const [rate_to_base, setRate] = useState<number>(0);
  const [rate_date, setDate] = useState(todayStr());

  // open and prefill when editing is set
  useEffect(() => {
    if (editing) {
      setCur(editing.currency_code ?? "");
      setRate(editing.rate_to_base ?? 0);
      setDate(editing.rate_date ?? todayStr());
      setOpen(true);
    }
  }, [editing]);

  const submit = async () => {
    if (!currency_code || !rate_to_base) return;
    const { data: u } = await supabase.auth.getUser();
    if (editing && editing.id) {
      const { error } = await supabase.from("exchange_rates").update({ currency_code, rate_to_base, rate_date, updated_by: u.user?.id }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success(t("save_success")); setOpen(false); onDone(); if (onCancelEdit) onCancelEdit(); return;
    }
    const { error } = await supabase.from("exchange_rates").insert({ currency_code, rate_to_base, rate_date, created_by: u.user?.id });
    if (error) return toast.error(error.message);
    toast.success(t("save_success")); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && editing && onCancelEdit) onCancelEdit(); }}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? t("edit") : t("exchange_rates")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("currency")}</Label>
            <Select value={currency_code} onValueChange={setCur}>
              <SelectTrigger><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>{currencies.filter((c) => !c.is_base).map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("exchange_rate")}</Label><Input type="number" step="0.0001" value={rate_to_base} onChange={(e) => setRate(Number(e.target.value))} /></div>
          <div><Label>{t("rate_date")}</Label><DatePicker value={rate_date} onValueChange={setDate} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); if (editing && onCancelEdit) onCancelEdit(); }}>{t("cancel")}</Button>
          <Button onClick={submit}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}