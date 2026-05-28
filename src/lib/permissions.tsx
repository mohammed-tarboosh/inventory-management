import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      return { ...data.user, profile };
    },
  });
}

export function usePermissions() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const [direct, groups] = await Promise.all([
        supabase.from("user_permissions").select("permission_key").eq("user_id", userId),
        supabase
          .from("user_permission_groups")
          .select("group_id, permission_group_items:group_id(permission_key)")
          .eq("user_id", userId),
      ]);
      const set = new Set<string>();
      direct.data?.forEach((r: any) => set.add(r.permission_key));
      // fetch group perms separately
      const groupIds = (groups.data ?? []).map((g: any) => g.group_id);
      if (groupIds.length) {
        const { data: gp } = await supabase
          .from("permission_group_items")
          .select("permission_key")
          .in("group_id", groupIds);
        gp?.forEach((r: any) => set.add(r.permission_key));
      }
      return Array.from(set);
    },
  });

  const perms = query.data ?? [];
  const can = (key: string) => perms.includes(key) || perms.includes("system.admin");
  return { perms, can, isLoading: query.isLoading };
}

export function RequirePerm({ perm, children, fallback }: { perm: string; children: ReactNode; fallback?: ReactNode }) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!can(perm)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}