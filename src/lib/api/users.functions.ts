import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveAuthEmail } from "../auth";
import { getAdminSupabase } from "./admin";

// Use shared admin wrapper in ./admin.ts

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      actorId: z.string().uuid().optional(),
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
    const actorId = data.actorId ?? null;

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

    // Ensure profile row exists/updated. If this fails, rollback the created auth user
    // to avoid leaving an orphaned auth account without a profile.
    const profileUpdate = await client.rpc("admin_update_profile", {
      p_user_id: userId,
      p_actor_id: actorId,
      p_username: data.username,
      p_full_name: data.full_name ?? null,
      p_is_active: data.is_active ?? true,
    });
    if (profileUpdate.error) {
      // Attempt best-effort rollback of the auth user we just created.
      try {
        await client.auth.admin.deleteUser(userId);
      } catch (rollbackErr) {
        console.error("Failed to rollback created auth user after profile update error:", rollbackErr);
      }
      throw profileUpdate.error;
    }

    if (typeof data.is_active === "boolean" && data.is_active === false) {
      const { error: banError } = await client.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banError) throw banError;
    }

    return { user: { id: userId, email: resolvedEmail, username: data.username, full_name: data.full_name ?? null } };
  });

export const updateUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      actorId: z.string().uuid().optional(),
      userId: z.string().min(1),
      username: z.string().optional(),
      full_name: z.string().optional(),
      email: z.string().email().optional(),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId, username, full_name, email, is_active, actorId } = data;

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
      const up = await client.rpc("admin_update_profile", {
        p_user_id: userId,
        p_actor_id: actorId ?? userId,
        p_username: (username ?? null),
        p_full_name: full_name ?? null,
        p_is_active: typeof is_active === "boolean" ? is_active : null,
      });
      if (up.error) throw up.error;
      return { profile: up.data };
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1), actorId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId, actorId } = data;

    // Note: These DB deletes are executed sequentially. Ideally these should
    // be done in a single database transaction (server-side) so they can be
    // rolled back if the final auth deletion fails. Supabase JS doesn't expose
    // a cross-service transaction for Auth + Postgres; therefore we perform
    // DB cleanup first, then remove the auth user. If the final step fails,
    // manual recovery may be required.

    const prof = await client.rpc("admin_delete_user_data", {
      p_user_id: userId,
      p_actor_id: actorId ?? userId,
    });
    if (prof.error) {
      throw new Error(`Failed to delete user data for ${userId}: ${prof.error.message}`);
    }

    const { error: deleteError } = await client.auth.admin.deleteUser(userId);
    if (deleteError) {
      // We deleted DB rows but failed to delete the auth user — this is a
      // potentially destructive partial state. Surface a clear error and
      // recommend manual steps to reconcile.
      console.error(`Auth deletion failed for ${userId} after DB cleanup:`, deleteError);
      throw new Error(
        `Failed to delete auth user ${userId} after removing DB rows. Manual reconciliation required: ${deleteError.message}`,
      );
    }

    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const config = getServerConfig();
    const auditActor = config.auditSystemUserId ?? process.env.SUPABASE_AUDIT_SYSTEM_USER_ID ?? null;
    await setAuditChangedBy(client, auditActor);
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
