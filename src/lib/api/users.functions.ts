import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { getServerConfig } from "../config.server";
import { resolveAuthEmail } from "../auth";

function getAdminSupabase() {
  const config = getServerConfig();
  const serviceRole = config.supabaseServiceRole ?? process.env.SUPABASE_SERVICE_ROLE;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE in server environment");
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL in server environment");

  return createClient<Database>(SUPABASE_URL, serviceRole, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: z.string().min(1),
      full_name: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const resolvedEmail = data.email ?? resolveAuthEmail(data.username).email;

    if (!resolvedEmail) {
      throw new Error("Email is required for creating a user");
    }

    const { data: existingProfile, error: existingError } = await client
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingProfile) throw new Error("Username already exists");

    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: resolvedEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        full_name: data.full_name ?? data.username,
      },
    });
    if (createError) throw createError;
    if (!created.user?.id) throw new Error("Failed to create user: missing id in Supabase response");

    const userId = created.user.id;

    const profileUpdate = await client
      .from("profiles")
      .update({
        username: data.username,
        full_name: data.full_name ?? null,
        is_active: data.is_active ?? true,
      })
      .eq("id", userId)
      .select()
      .maybeSingle();
    if (profileUpdate.error) throw profileUpdate.error;

    if (typeof data.is_active === "boolean" && data.is_active === false) {
      const { error: banError } = await client.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banError) throw banError;
    }

    return { user: { id: userId, email: resolvedEmail, username: data.username, full_name: data.full_name ?? null } };
  });

export const updateUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      username: z.string().optional(),
      full_name: z.string().optional(),
      email: z.string().email().optional(),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId, username, full_name, email, is_active } = data;

    const updatePayload: Record<string, unknown> = {};
    if (email) updatePayload.email = email;
    const userMetadata: Record<string, unknown> = {};
    if (username) userMetadata.username = username;
    if (full_name !== undefined) userMetadata.full_name = full_name;
    if (Object.keys(userMetadata).length) updatePayload.user_metadata = userMetadata;
    if (typeof is_active === "boolean") updatePayload.ban_duration = is_active ? "none" : "876000h";

    if (Object.keys(updatePayload).length) {
      const { error: updateError } = await client.auth.admin.updateUserById(userId, updatePayload as Parameters<typeof client.auth.admin.updateUserById>[1]);
      if (updateError) throw updateError;
    }

    const profileUpdate: any = {};
    if (username) profileUpdate.username = username;
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (typeof is_active === "boolean") profileUpdate.is_active = is_active;
    if (Object.keys(profileUpdate).length) {
      const up = await client.from("profiles").update(profileUpdate).eq("id", userId).select().maybeSingle();
      if (up.error) throw up.error;
      return { profile: up.data };
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId } = data;

    // Remove permission-related rows first
    const perms = await client.from("user_permissions").delete().eq("user_id", userId);
    if (perms.error) throw perms.error;

    // Remove profile row
    const prof = await client.from("profiles").delete().eq("id", userId);
    if (prof.error) throw prof.error;

    const { error: deleteError } = await client.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId } = data;

    const { data: userResult, error: userError } = await client.auth.admin.getUserById(userId);
    if (userError) throw userError;

    const email = userResult.user?.email;
    if (!email) throw new Error("User has no email to send reset to");

    // Trigger password recovery email
    const { error: resetError } = await client.auth.resetPasswordForEmail(email);
    if (resetError) throw resetError;

    return { ok: true };
  });

export default {};
