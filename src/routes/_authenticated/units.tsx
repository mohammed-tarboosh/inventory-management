import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/units")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*").order("name_ar")).data ?? [],
  });
  const refetch = () => qc.invalidateQueries({ queryKey: ["units"] });

  return (
    <div>
      <PageHeader title={t("units")}>{can("settings.manage") && <UnitForm onDone={refetch} />}</PageHeader>
      <DataTable rows={rows} columns={[
        { key: "ar", header: t("name_ar"), cell: (r: any) => r.name_ar },
        { key: "en", header: t("name_en"), cell: (r: any) => r.name_en },
        { key: "a", header: t("actions"), className: "w-32", cell: (r: any) => can("settings.manage") && (
          <div className="flex gap-1">
            <UnitForm row={r} onDone={refetch} />
            <ConfirmDelete onConfirm={async () => {
              const { error } = await supabase.from("units").delete().eq("id", r.id);
              if (error) toast.error(error.message); else { toast.success(t("save_success")); refetch(); }
            }} />
          </div>
        ) },
      ]} />
    </div>
  );
}

function UnitForm({ row, onDone }: { row?: any; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name_ar, setAr] = useState(row?.name_ar ?? "");
  const [name_en, setEn] = useState(row?.name_en ?? "");
  const submit = async () => {
    const payload = { name_ar, name_en };
    const { error } = row
      ? await supabase.from("units").update(payload).eq("id", row.id)
      : await supabase.from("units").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("save_success")); setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button> : <Button><Plus className="h-4 w-4 me-1" />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("units")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("name_ar")}</Label><Input value={name_ar} onChange={(e) => setAr(e.target.value)} /></div>
          <div><Label>{t("name_en")}</Label><Input value={name_en} onChange={(e) => setEn(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!name_ar || !name_en}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}