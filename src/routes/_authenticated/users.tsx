import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({ component: Page });

function Page() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: async () => (await supabase.from("profiles").select("*").order("username")).data ?? [] });
  const { data: permissions = [] } = useQuery({ queryKey: ["permissions_list"], queryFn: async () => (await supabase.from("permissions").select("*").order("category")).data ?? [] });
  const { data: groups = [] } = useQuery({ queryKey: ["pgroups"], queryFn: async () => (await supabase.from("permission_groups").select("*")).data ?? [] });
  const { data: userGroups = [] } = useQuery({ queryKey: ["upg_all"], queryFn: async () => (await supabase.from("user_permission_groups").select("*")).data ?? [] });
  const { data: userPerms = [] } = useQuery({ queryKey: ["up_all"], queryFn: async () => (await supabase.from("user_permissions").select("*")).data ?? [] });

  if (!can("users.manage") && !can("permissions.manage")) return <PageHeader title={t("no_permission")} />;

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["upg_all"] });
    qc.invalidateQueries({ queryKey: ["up_all"] });
  };

  return (
    <div>
      <PageHeader title={t("users")} />
      <DataTable rows={profiles as any[]} columns={[
        { key: "u", header: t("username"), cell: (r: any) => r.username },
        { key: "n", header: t("full_name"), cell: (r: any) => r.full_name ?? "-" },
        { key: "a", header: t("is_active"), cell: (r: any) => r.is_active ? "✓" : "✗" },
        { key: "g", header: t("role_group"), cell: (r: any) => (userGroups as any[]).filter(g => g.user_id === r.id).map(g => (groups as any[]).find(x => x.id === g.group_id)?.name).join(", ") || "-" },
        { key: "act", header: t("actions"), cell: (r: any) => can("permissions.manage") && (
          <PermDialog profile={r} permissions={permissions as any[]} groups={groups as any[]} userGroups={userGroups as any[]} userPerms={userPerms as any[]} onDone={refetch} locale={locale} />
        ) },
      ]} />
    </div>
  );
}

function PermDialog({ profile, permissions, groups, userGroups, userPerms, onDone, locale }: any) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedGroups(new Set((userGroups as any[]).filter((g) => g.user_id === profile.id).map((g) => g.group_id)));
    setSelectedPerms(new Set((userPerms as any[]).filter((p) => p.user_id === profile.id).map((p) => p.permission_key)));
  }, [open, profile.id, userGroups, userPerms]);

  const save = async () => {
    await supabase.from("user_permission_groups").delete().eq("user_id", profile.id);
    await supabase.from("user_permissions").delete().eq("user_id", profile.id);
    if (selectedGroups.size) {
      const { error } = await supabase.from("user_permission_groups").insert(Array.from(selectedGroups).map((g) => ({ user_id: profile.id, group_id: g })));
      if (error) { toast.error(error.message); return; }
    }
    if (selectedPerms.size) {
      const { error } = await supabase.from("user_permissions").insert(Array.from(selectedPerms).map((p) => ({ user_id: profile.id, permission_key: p })));
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("save_success"));
    setOpen(false); onDone();
  };

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const n = new Set(set);
    n.has(key) ? n.delete(key) : n.add(key);
    setSet(n);
  };

  const cats: Record<string, any[]> = {};
  for (const p of permissions) (cats[p.category] ??= []).push(p);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><ShieldCheck className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("permissions")} - {profile.username}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{t("permission_groups")}</h3>
            <div className="flex flex-wrap gap-3">
              {groups.map((g: any) => (
                <label key={g.id} className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer">
                  <Checkbox checked={selectedGroups.has(g.id)} onCheckedChange={() => toggle(selectedGroups, setSelectedGroups, g.id)} />
                  <span>{g.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t("permissions")}</h3>
            {Object.entries(cats).map(([cat, perms]) => (
              <div key={cat} className="mb-3">
                <div className="text-sm text-muted-foreground mb-1">{cat}</div>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((p: any) => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedPerms.has(p.key)} onCheckedChange={() => toggle(selectedPerms, setSelectedPerms, p.key)} />
                      <span className="text-sm">{locale === "ar" ? p.label_ar : p.label_en}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={save}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}