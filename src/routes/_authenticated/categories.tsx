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

  // Build a flattened tree for display with depth for indentation
  // Work on shallow copies to avoid mutating original rows (prevents duplicate children accumulation)
  const buildTree = (items: any[]) => {
    const copies = (items || []).map((it) => ({ ...it }));
    const map = copies.reduce((acc: Record<string, any>, it: any) => ((acc[it.id] = it), acc), {} as Record<string, any>);
    const roots: any[] = [];
    copies.forEach((it) => {
      if (it.parent_id && map[it.parent_id]) {
        map[it.parent_id].children = map[it.parent_id].children || [];
        map[it.parent_id].children.push(it);
      } else {
        roots.push(it);
      }
    });
    return roots;
  };
  const flattened: any[] = [];
  const walk = (nodes: any[], depth = 0) => {
    nodes.forEach((n) => {
      flattened.push({ ...n, depth });
      if (n.children) walk(n.children, depth + 1);
    });
  };
  const treeRoots = buildTree(rows as any[]);
  walk(treeRoots, 0);

  const refetch = () => qc.invalidateQueries({ queryKey: ["categories"] });

  return (
    <div>
      <PageHeader title={t("categories") }>
        {can("items.manage") && <CategoryForm categories={rows} onDone={refetch} />}
      </PageHeader>
      <DataTable
        rows={flattened}
        columns={[
          { key: "name_ar", header: t("name_ar"), cell: (r: any) => <span style={{ marginLeft: `${(r.depth ?? 0) * 1}rem` }}>{r.name_ar}</span> },
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
  const [type, setType] = useState<string>(row?.parent_id ? "sub" : "primary");
  const [submitting, setSubmitting] = useState(false);

  // helper: detect if candidateId is ancestor of nodeId (to avoid cycles)
  const isAncestor = (candidateId: string | null, nodeId: string | null) => {
    if (!candidateId || !nodeId || !categories) return false;
    const map = (categories as any[]).reduce((acc: any, it: any) => (acc[it.id] = it, acc), {} as Record<string, any>);
    let cur = candidateId;
    while (cur) {
      if (cur === nodeId) return true;
      const next = map[cur]?.parent_id;
      if (!next) break;
      cur = next;
    }
    return false;
  };

  const allowedParents = (categories ?? []).filter((c: any) => c.id !== row?.id && !isAncestor(c.id, row?.id ?? null));

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const trimmedName = name_ar.trim();
      // prevent duplicate name under same parent
      const exists = (categories ?? []).some((c: any) => c.name_ar?.trim() === trimmedName && ((type === "primary" && !c.parent_id) || c.parent_id === (type === "sub" ? parent_id : null)));
      if (exists) {
        toast.error(t("already_exists"));
        return;
      }

      const payload: any = { name_ar: trimmedName, name_en: name_en?.trim() || null, parent_id: type === "sub" ? parent_id : null };
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
    } finally {
      setSubmitting(false);
    }
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
            <Label>{t("category_type")}</Label>
            <Select value={type} onValueChange={(v) => { setType(v); if (v === "primary") setParentId(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">{t("primary")}</SelectItem>
                <SelectItem value="sub">{t("subcategory")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "sub" && (
            <div>
              <Label>{t("parent_category")}</Label>
              <Select value={parent_id ?? "_"} onValueChange={(v) => setParentId(v === "_" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">{t("none")}</SelectItem>
                  {allowedParents.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!name_ar || submitting}>{submitting ? t("saving") : t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}