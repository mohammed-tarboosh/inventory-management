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
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/categories")({ component: Page });

function Page() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name_ar")).data ?? [],
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ["categories"] });

  return (
    <div>
      <PageHeader title={t("categories")}>
        {can("items.manage") && <CategoryForm onDone={refetch} />}
      </PageHeader>
      <DataTable
        rows={rows}
        columns={[
          { key: "name_ar", header: t("name_ar"), cell: (r: any) => r.name_ar },
          { key: "name_en", header: t("name_en"), cell: (r: any) => r.name_en ?? "-" },
          { key: "parent", header: t("parent_category"), cell: (r: any) => rows.find((x: any) => x.id === r.parent_id)?.name_ar ?? "-" },
          {
            key: "actions", header: t("actions"), className: "w-32",
            cell: (r: any) => can("items.manage") ? (
              <div className="flex gap-1">
                <CategoryForm row={r} categories={rows} onDone={refetch} />
                <ConfirmDelete onConfirm={async () => {
                  const { error } = await supabase.from("categories").delete().eq("id", r.id);
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

function CategoryForm({ row, categories, onDone }: { row?: any; categories?: any[]; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name_ar, setNameAr] = useState(row?.name_ar ?? "");
  const [name_en, setNameEn] = useState(row?.name_en ?? "");
  const [parent_id, setParentId] = useState<string | null>(row?.parent_id ?? null);

  const submit = async () => {
    const payload: any = { name_ar, name_en: name_en || null, parent_id };
    const { data: u } = await supabase.auth.getUser();
    if (row) {
      payload.updated_by = u.user?.id;
      const { error } = await supabase.from("categories").update(payload).eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = u.user?.id;
      const { error } = await supabase.from("categories").insert(payload);
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
        <DialogHeader><DialogTitle>{row ? t("edit") : t("add")} - {t("categories")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("name_ar")}</Label><Input value={name_ar} onChange={(e) => setNameAr(e.target.value)} /></div>
          <div><Label>{t("name_en")}</Label><Input value={name_en} onChange={(e) => setNameEn(e.target.value)} /></div>
          <div>
            <Label>{t("parent_category")}</Label>
            <Select value={parent_id ?? "_"} onValueChange={(v) => setParentId(v === "_" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {(categories ?? []).filter((c: any) => c.id !== row?.id).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!name_ar}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}