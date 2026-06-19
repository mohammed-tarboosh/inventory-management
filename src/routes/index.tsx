import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // During SSR (window is undefined), always redirect to /login —
    // avoids the blank white page caused by rendering null server-side.
    if (typeof window === "undefined") throw redirect({ to: "/login" });
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
