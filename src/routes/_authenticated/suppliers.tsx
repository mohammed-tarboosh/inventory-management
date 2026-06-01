import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
  const refetch = () => qc.invalidateQueries({ queryKey: ["suppliers"] });
  return (
    <div>
      <PageHeader title={t("suppliers")}>{can("suppliers.manage") && <SForm onDone={refetch} />}</PageHeader>
      <DataTable rows={rows} columns={[
        { key: "n", header: t("name"), cell: (r: any) => r.name },
        { key: "p", header: t("phone"), cell: (r: any) => r.phone ?? "-" },
        { key: "nt", header: t("notes"), cell: (r: any) => r.notes ?? "-" },
        { key: "a", header: t("actions"), className: "w-32", cell: (r: any) => can("suppliers.manage") && (
          <div className="flex gap-1">
            <SForm row={r} onDone={refetch} />
            <ConfirmDelete onConfirm={async () => {
              const { error } = await supabase.from("suppliers").delete().eq("id", r.id);
              if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
            }} />
          </div>
        ) },
      ]} />
    </div>
  );
}

function SForm({ row, onDone }: { row?: any; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row?.name ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [default_currency, setDefaultCurrency] = useState(row?.default_currency ?? "_");
  const [default_payment_type, setDefaultPaymentType] = useState(row?.default_payment_type ?? "cash");
  const [nameError, setNameError] = useState("");
  const { data: currencies = [] } = useQuery({ queryKey: ["currencies"], queryFn: async () => (await supabase.from("currencies").select("*")).data ?? [] });
  const submit = async () => {
    if (!name.trim()) {
      setNameError("الحقل إجباري");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { name, phone: phone || null, notes: notes || null };
    payload.default_currency = default_currency === "_" ? null : default_currency || null;
    payload.default_payment_type = default_payment_type;
    if (row) payload.updated_by = u.user?.id; else payload.created_by = u.user?.id;
    const { error } = row
      ? await supabase.from("suppliers").update(payload).eq("id", row.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("save_success")); setNameError(""); setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button> : <Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("suppliers")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("name")}</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div><Label>{t("phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>العملة الافتراضية</Label>
            <Select value={default_currency} onValueChange={(v) => setDefaultCurrency(v)}>
              <SelectTrigger><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نوع الدفع الافتراضي</Label>
            <Select value={default_payment_type} onValueChange={(v) => setDefaultPaymentType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("cash")}</SelectItem>
                <SelectItem value="credit">{t("credit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!name}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}