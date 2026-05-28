import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/customers")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const refetch = () => qc.invalidateQueries({ queryKey: ["customers"] });
  return (
    <div>
      <PageHeader title={t("customers")}>{can("customers.manage") && <CForm onDone={refetch} />}</PageHeader>
      <DataTable rows={rows} columns={[
        { key: "n", header: t("name"), cell: (r: any) => r.name },
        { key: "p", header: t("phone"), cell: (r: any) => r.phone ?? "-" },
        { key: "nt", header: t("notes"), cell: (r: any) => r.notes ?? "-" },
        { key: "a", header: t("actions"), className: "w-32", cell: (r: any) => can("customers.manage") && (
          <div className="flex gap-1">
            <CForm row={r} onDone={refetch} />
            <ConfirmDelete onConfirm={async () => {
              const { error } = await supabase.from("customers").delete().eq("id", r.id);
              if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
            }} />
          </div>
        ) },
      ]} />
    </div>
  );
}

function CForm({ row, onDone }: { row?: any; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row?.name ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const submit = async () => {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { name, phone: phone || null, notes: notes || null };
    if (row) payload.updated_by = u.user?.id; else payload.created_by = u.user?.id;
    const { error } = row
      ? await supabase.from("customers").update(payload).eq("id", row.id)
      : await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("save_success")); setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button> : <Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("customers")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>{t("phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
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