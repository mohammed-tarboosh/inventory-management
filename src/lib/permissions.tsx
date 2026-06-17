import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UserPermissionRow = Database["public"]["Tables"]["user_permissions"]["Row"];
type UserPermissionGroupRow = Database["public"]["Tables"]["user_permission_groups"]["Row"];
type PermissionGroupItemRow = { permission_key: string };

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

  const query = useQuery({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const set = new Set<string>();
      const { data: direct } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", userId);
      direct?.forEach((r) => set.add(r.permission_key));
      const { data: ug } = await supabase
        .from("user_permission_groups")
        .select("group_id")
        .eq("user_id", userId);
      const groupIds = (ug ?? []).map((g) => g.group_id);
      if (groupIds.length) {
        const { data: gp } = await supabase
          .from("permission_group_items")
          .select("permission_key")
          .in("group_id", groupIds);
        gp?.forEach((r) => set.add(r.permission_key));
      }
      return Array.from(set);
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
