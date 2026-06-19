import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UserPermissionRow = Database["public"]["Tables"]["user_permissions"]["Row"];
type UserPermissionGroupRow = Database["public"]["Tables"]["user_permission_groups"]["Row"];
type PermissionGroupItemRow = Database["public"]["Tables"]["permission_group_items"]["Row"];
type CurrentUserResult = {
  id: string;
  email: string | null;
  profile: ProfileRow | null;
};

export function useCurrentUser() {
  return useQuery<CurrentUserResult | null>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      return { id: data.user.id, email: data.user.email ?? null, profile: profile ?? null };
    },
  });
}

export function buildEffectivePermissions(
  userPerms: string[],
  userGroups: string[],
  groupItems: PermissionGroupItemRow[],
) {
  const result = new Set<string>(userPerms);
  const itemsByGroup = new Map<string, string[]>();
  for (const item of groupItems) {
    itemsByGroup.set(item.group_id, [...(itemsByGroup.get(item.group_id) ?? []), item.permission_key]);
  }
  for (const groupId of userGroups) {
    const permissions = itemsByGroup.get(groupId) ?? [];
    permissions.forEach((perm) => result.add(perm));
  }
  return Array.from(result);
}

export async function loadEffectivePermissions(userId: string) {
  const { data: direct } = await supabase
    .from("user_permissions")
    .select("permission_key")
    .eq("user_id", userId);

  const { data: ug } = await supabase
    .from("user_permission_groups")
    .select("group_id")
    .eq("user_id", userId);

  const groupIds = (ug ?? []).map((g: { group_id: string }) => g.group_id);
  const groupItems = groupIds.length
    ? (await supabase
        .from("permission_group_items")
        .select("group_id,permission_key")
        .in("group_id", groupIds)).data ?? []
    : [];

  return buildEffectivePermissions(
    (direct ?? []).map((r) => r.permission_key),
    groupIds,
    groupItems,
  );
}

export async function loadCurrentUserPermissions() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return [];
  return loadEffectivePermissions(data.user.id);
}

export async function userHasPermission(permission: string) {
  const permissions = await loadCurrentUserPermissions();
  return permissions.includes(permission) || permissions.includes("system.admin");
}

export async function userHasAnyPermission(keys: string[]) {
  const permissions = await loadCurrentUserPermissions();
  return permissions.includes("system.admin") || keys.some((key) => permissions.includes(key));
}

export function usePermissions() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const query = useQuery<string[]>({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      return loadEffectivePermissions(userId);
    },
  });

  const perms = query.data ?? [];
  const can = (key: string) => perms.includes(key) || perms.includes("system.admin");
  return { perms, can, isLoading: query.isLoading };
}

export function RequirePerm({
  perm,
  children,
  fallback,
}: {
  perm: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!can(perm)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
