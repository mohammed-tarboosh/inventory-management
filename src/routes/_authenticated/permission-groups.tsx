import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useI18n } from "@/lib/i18n";
import { usePermissions, userHasPermission } from "@/lib/permissions";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type PermissionGroupRow = {
  id: string;
  name: string;
  description: string | null;
};

type PermissionRow = {
  key: string;
  label_ar: string;
  label_en: string;
};

type PermissionGroupItemRow = {
  group_id: string;
  permission_key: string;
};

export const Route = createFileRoute("/_authenticated/permission-groups")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const allowed = await userHasPermission("permissions.manage");
    if (!allowed) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const { can, isLoading } = usePermissions();
  const qc = useQueryClient();

  const { data: groups = [] } = useQuery<PermissionGroupRow[]>({
    queryKey: ["permission_groups"],
    queryFn: async () => (await supabase.from("permission_groups").select("*")).data ?? [],
    enabled: !isLoading,
  });
  const { data: permissions = [] } = useQuery<PermissionRow[]>({
    queryKey: ["permissions_list"],
    queryFn: async () => (await supabase.from("permissions").select("*")).data ?? [],
    enabled: !isLoading,
  });
  const { data: permissionGroupItems = [] } = useQuery<PermissionGroupItemRow[]>({
    queryKey: ["permission_group_items"],
    queryFn: async () =>
      (await supabase.from("permission_group_items").select("group_id,permission_key")).data ?? [],
    enabled: !isLoading,
  });

  const permissionLabels = useMemo(
    () =>
      new Map(
        permissions.map((p) => [p.key, locale === "ar" ? p.label_ar : p.label_en]),
      ),
    [permissions, locale],
  );

  const permissionsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    permissionGroupItems.forEach((item) => {
      map.set(item.group_id, [...(map.get(item.group_id) ?? []), item.permission_key]);
    });
    return map;
  }, [permissionGroupItems]);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["permission_groups"] });
    qc.invalidateQueries({ queryKey: ["permission_group_items"] });
  };

  return (
    <div>
      <PageHeader title={t("permission_groups")}>
        {can("permissions.manage") && (
          <GroupDialog
            permissions={permissions}
            permissionLabels={permissionLabels}
            onDone={refetch}
          >
            <Button>{t("new_permission_group")}</Button>
          </GroupDialog>
        )}
      </PageHeader>

      <DataTable
        rows={groups}
        columns={[
          { key: "name", header: t("group_name"), cell: (r) => r.name },
          {
            key: "description",
            header: t("group_description"),
            cell: (r) => r.description || "-",
          },
          {
            key: "permissions",
            header: t("permissions_in_group"),
            cell: (r) => {
              const keys = permissionsByGroup.get(r.id) ?? [];
              if (!keys.length) return "-";
              return (
                <div className="flex flex-wrap gap-1">
                  {keys.slice(0, 6).map((key) => (
                    <span
                      key={key}
                      className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {permissionLabels.get(key) ?? key}
                    </span>
                  ))}
                  {keys.length > 6 ? (
                    <span className="text-xs text-muted-foreground">
                      +{keys.length - 6}
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "actions",
            header: t("actions"),
            cell: (r) => (
              <div className="flex items-center gap-2">
                <GroupDialog
                  group={r}
                  permissions={permissions}
                  permissionLabels={permissionLabels}
                  onDone={refetch}
                >
                  <Button variant="ghost" size="icon">
                    ✎
                  </Button>
                </GroupDialog>
                <ConfirmDelete
                  trigger={
                    <Button variant="ghost" size="icon" className="text-destructive">
                      🗑
                    </Button>
                  }
                  onConfirm={async () => {
                    try {
                      const { error } = await supabase
                        .from("permission_groups")
                        .delete()
                        .eq("id", r.id);
                      if (error) throw error;
                      toast.success(t("delete_success"));
                      refetch();
                    } catch (err: any) {
                      toast.error(err?.message || String(err));
                    }
                  }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function GroupDialog({
  group,
  permissions,
  permissionLabels,
  onDone,
  children,
}: {
  group?: PermissionGroupRow;
  permissions: PermissionRow[];
  permissionLabels: Map<string, string>;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setSelected(new Set());

    if (group) {
      const loadKeys = async () => {
        const { data } = await supabase
          .from("permission_group_items")
          .select("permission_key")
          .eq("group_id", group.id);
        setSelected(new Set((data ?? []).map((item) => item.permission_key)));
      };
      loadKeys();
    }
  }, [open, group]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("name") + " " + t("is_required"));
      return;
    }

    try {
      let groupId = group?.id;
      if (groupId) {
        const { error } = await supabase
          .from("permission_groups")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", groupId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("permission_groups")
          .insert({ name: name.trim(), description: description.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      if (!groupId) throw new Error("Missing group id");

      const { data: existingItems = [] } = await supabase
        .from("permission_group_items")
        .select("permission_key")
        .eq("group_id", groupId);

      const existingKeys = new Set((existingItems as PermissionGroupItemRow[]).map((i) => i.permission_key));
      const desiredKeys = Array.from(selected);
      const keysToDelete = Array.from(existingKeys).filter((key) => !selected.has(key));
      const keysToInsert = desiredKeys.filter((key) => !existingKeys.has(key));

      if (keysToDelete.length) {
        const { error } = await supabase
          .from("permission_group_items")
          .delete()
          .eq("group_id", groupId)
          .in("permission_key", keysToDelete);
        if (error) throw error;
      }

      if (keysToInsert.length) {
        const { error } = await supabase
          .from("permission_group_items")
          .insert(keysToInsert.map((permission_key) => ({ group_id: groupId, permission_key })));
        if (error) throw error;
      }

      toast.success(t("save_success"));
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err?.message || String(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {group ? t("edit_permission_group") : t("new_permission_group")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">{t("group_name")}</Label>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">{t("group_description")}</Label>
            <Input
              id="group-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t("permissions_in_group")}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {permissions.map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selected.has(permission.key)}
                    onCheckedChange={() => toggle(permission.key)}
                  />
                  <span>{permissionLabels.get(permission.key) ?? permission.key}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={save}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
