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
import { buildEffectivePermissions, usePermissions, userHasAnyPermission } from "@/lib/permissions";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createUser, updateUser, deleteUser, adminResetPassword } from "@/lib/api/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const allowed = await userHasAnyPermission(["users.manage", "permissions.manage"]);
    if (!allowed) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("username")).data ?? [],
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions_list"],
    queryFn: async () =>
      (await supabase.from("permissions").select("*").order("category")).data ?? [],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["pgroups"],
    queryFn: async () => (await supabase.from("permission_groups").select("*")).data ?? [],
  });
  const { data: userGroups = [] } = useQuery({
    queryKey: ["upg_all"],
    queryFn: async () => (await supabase.from("user_permission_groups").select("*")).data ?? [],
  });
  const { data: userPerms = [] } = useQuery({
    queryKey: ["up_all"],
    queryFn: async () => (await supabase.from("user_permissions").select("*")).data ?? [],
  });
  const { data: permissionGroupItems = [] } = useQuery({
    queryKey: ["permission_group_items"],
    queryFn: async () =>
      (await supabase.from("permission_group_items").select("*")).data ?? [],
  });

  const permissionLabels = useMemo(
    () =>
      new Map(
        (permissions as any[]).map((p) => [p.key, locale === "ar" ? p.label_ar : p.label_en]),
      ),
    [permissions, locale],
  );

  const groupNames = useMemo(
    () => new Map((groups as any[]).map((g) => [g.id, g.name])),
    [groups],
  );

  const effectivePermissionsByUser = useMemo(() => {
    const result = new Map<string, { direct: string[]; inherited: string[]; effective: string[] }>();
    const directMap = new Map<string, string[]>();
    const groupMap = new Map<string, string[]>();

    (userPerms as any[]).forEach((perm) => {
      directMap.set(perm.user_id, [...(directMap.get(perm.user_id) ?? []), perm.permission_key]);
    });
    (userGroups as any[]).forEach((link) => {
      groupMap.set(link.user_id, [...(groupMap.get(link.user_id) ?? []), link.group_id]);
    });

    (profiles as any[]).forEach((profile) => {
      const direct = Array.from(new Set(directMap.get(profile.id) ?? []));
      const groupIds = groupMap.get(profile.id) ?? [];
      const effective = buildEffectivePermissions(direct, groupIds, permissionGroupItems as any[]);
      const inherited = effective.filter((key) => !direct.includes(key));
      result.set(profile.id, { direct, inherited, effective });
    });

    return result;
  }, [profiles, userGroups, userPerms, permissionGroupItems]);

  if (!can("users.manage") && !can("permissions.manage"))
    return <PageHeader title={t("no_permission")} />;

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["upg_all"] });
    qc.invalidateQueries({ queryKey: ["up_all"] });
    qc.invalidateQueries({ queryKey: ["permission_group_items"] });
  };

  return (
    <div>
      <PageHeader title={t("users")}>
        {can("users.manage") && (
          <UserDialog trigger={<Button>{t("new_user")}</Button>} onDone={refetch} />
        )}
      </PageHeader>
      <DataTable
        rows={profiles as any[]}
        columns={[
          { key: "u", header: t("username"), cell: (r: any) => r.username },
          { key: "n", header: t("full_name"), cell: (r: any) => r.full_name ?? "-" },
          { key: "a", header: t("is_active"), cell: (r: any) => (r.is_active ? "✓" : "✗") },
          {
            key: "g",
            header: t("role_group"),
            cell: (r: any) =>
              (userGroups as any[])
                .filter((g) => g.user_id === r.id)
                .map((g) => groupNames.get(g.group_id) ?? g.group_id)
                .join(", ") || "-",
          },
          {
            key: "effective_permissions",
            header: t("effective_permissions"),
            cell: (r: any) => {
              const entry = effectivePermissionsByUser.get(r.id);
              if (!entry || !entry.effective.length) return "-";
              return (
                <div className="flex flex-wrap gap-1">
                  {entry.effective.slice(0, 6).map((key) => (
                    <span
                      key={key}
                      className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {permissionLabels.get(key) ?? key}
                    </span>
                  ))}
                  {entry.effective.length > 6 ? (
                    <span className="text-xs text-muted-foreground">
                      +{entry.effective.length - 6}
                    </span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "act",
            header: t("actions"),
            cell: (r: any) => (
              <div className="flex items-center gap-2">
                {can("users.manage") && (
                  <>
                    <UserDialog
                      profile={r}
                      trigger={
                        <Button variant="ghost" size="icon">
                          ✎
                        </Button>
                      }
                      onDone={refetch}
                    />
                    <ConfirmDelete
                      trigger={
                        <Button variant="ghost" size="icon" className="text-destructive">
                          🗑
                        </Button>
                      }
                      onConfirm={async () => {
                        try {
                          const { data: authUser } = await supabase.auth.getUser();
                          await deleteUser({
                            data: { userId: r.id, actorId: authUser.user?.id ?? undefined },
                          });
                          toast.success(t("delete_success"));
                          refetch();
                        } catch (err: any) {
                          toast.error(err?.message || String(err));
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        try {
                          await adminResetPassword({ data: { userId: r.id } });
                          toast.success(t("reset_email_sent"));
                        } catch (err: any) {
                          toast.error(err?.message || String(err));
                        }
                      }}
                    >
                      ⟳
                    </Button>
                  </>
                )}
                {can("permissions.manage") && (
                  <PermDialog
                    profile={r}
                    permissions={permissions as any[]}
                    groups={groups as any[]}
                    userGroups={userGroups as any[]}
                    userPerms={userPerms as any[]}
                    onDone={refetch}
                    locale={locale}
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

function PermDialog({ profile, permissions, groups, userGroups, userPerms, onDone, locale }: any) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedGroups(
      new Set((userGroups as any[]).filter((g) => g.user_id === profile.id).map((g) => g.group_id)),
    );
    setSelectedPerms(
      new Set(
        (userPerms as any[]).filter((p) => p.user_id === profile.id).map((p) => p.permission_key),
      ),
    );
  }, [open, profile.id, userGroups, userPerms]);

  const save = async () => {
    // Compute diffs instead of wiping all rows: safer for partial failures.
    const existingGroupIds = new Set(
      (userGroups as any[]).filter((g) => g.user_id === profile.id).map((g) => g.group_id),
    );
    const existingPermKeys = new Set(
      (userPerms as any[]).filter((p) => p.user_id === profile.id).map((p) => p.permission_key),
    );

    const groupsToInsert = Array.from(selectedGroups).filter((g) => !existingGroupIds.has(g));
    const groupsToDelete = Array.from(existingGroupIds).filter((g: any) => !selectedGroups.has(g));

    const permsToInsert = Array.from(selectedPerms).filter((p) => !existingPermKeys.has(p));
    const permsToDelete = Array.from(existingPermKeys).filter((p: any) => !selectedPerms.has(p));

    // Execute deletions first (idempotent), then inserts. Handle errors explicitly.
    if (groupsToDelete.length) {
      const { error } = await supabase
        .from("user_permission_groups")
        .delete()
        .in("group_id", groupsToDelete)
        .eq("user_id", profile.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    if (permsToDelete.length) {
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .in("permission_key", permsToDelete)
        .eq("user_id", profile.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    if (groupsToInsert.length) {
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = authUser?.user?.id ?? null;
      const payload = groupsToInsert.map((g) => ({
        user_id: profile.id,
        group_id: g,
        created_by: actorId,
      }));
      const { error } = await supabase.from("user_permission_groups").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    if (permsToInsert.length) {
      const { data: authUser2 } = await supabase.auth.getUser();
      const actorId2 = authUser2?.user?.id ?? null;
      const payload = permsToInsert.map((p) => ({
        user_id: profile.id,
        permission_key: p,
        created_by: actorId2,
      }));
      const { error } = await supabase.from("user_permissions").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    toast.success(t("save_success"));
    setOpen(false);
    onDone();
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
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <ShieldCheck className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("permissions")} - {profile.username}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{t("permission_groups")}</h3>
            <div className="flex flex-wrap gap-3">
              {groups.map((g: any) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedGroups.has(g.id)}
                    onCheckedChange={() => toggle(selectedGroups, setSelectedGroups, g.id)}
                  />
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {perms.map((p: any) => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedPerms.has(p.key)}
                        onCheckedChange={() => toggle(selectedPerms, setSelectedPerms, p.key)}
                      />
                      <span className="text-sm">{locale === "ar" ? p.label_ar : p.label_en}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
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

function UserDialog({ profile, trigger, onDone }: any) {
  const isEdit = !!profile;
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setUsername(profile.username || "");
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setIsActive(!!profile.is_active);
    } else {
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setIsActive(true);
    }
  }, [open, isEdit, profile]);

  const save = async () => {
    setLoading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = authUser.user?.id ?? undefined;
      if (isEdit) {
        await updateUser({
          data: {
            userId: profile.id,
            actorId,
            username,
            full_name: fullName,
            email,
            is_active: isActive,
          },
        });
        toast.success(t("save_success"));
      } else {
        await createUser({
          data: { actorId, username, full_name: fullName, email, password, is_active: isActive },
        });
        toast.success(t("save_success"));
      }
      setOpen(false);
      onDone?.();
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>{isEdit ? t("edit") : t("new_user")}</Button>}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("edit_user") : t("new_user")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("username")}</Label>
            <Input value={username} onChange={(e: any) => setUsername(e.target.value)} required />
          </div>
          <div>
            <Label>{t("full_name")}</Label>
            <Input value={fullName} onChange={(e: any) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>{t("email")}</Label>
            <Input value={email} onChange={(e: any) => setEmail(e.target.value)} />
          </div>
          {!isEdit && (
            <div>
              <Label>{t("password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                required
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
            <span>{t("is_active")}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={loading}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
