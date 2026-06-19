import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { getServerConfig } from "../config.server";

export function getAdminSupabase() {
  const config = getServerConfig();
  const serviceRole =
    config.supabaseServiceRole ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE in server environment");
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL in server environment");

  return createClient<Database>(SUPABASE_URL, serviceRole, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function setAuditChangedBy(
  client: ReturnType<typeof getAdminSupabase>,
  userId: string | null,
) {
  if (!userId) return;
  try {
    // RPC will call the helper function created by migration
    await client.rpc("set_audit_changed_by", { audit_uid: userId });
  } catch (err) {
    // Best-effort: don't throw to avoid breaking admin flows if RPC not available
    console.error("Failed to set audit.changed_by RPC:", err);
  }
}

export async function runWithAudit(
  userId: string | null,
  fn: (client: ReturnType<typeof getAdminSupabase>) => Promise<any>,
) {
  const client = getAdminSupabase();
  if (userId) {
    await setAuditChangedBy(client, userId);
  }
  return fn(client);
}

export default {};
