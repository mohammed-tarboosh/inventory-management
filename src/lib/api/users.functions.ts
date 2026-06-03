import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { getServerConfig } from "../config.server";
import { resolveAuthEmail } from "../auth";

/**
 * إنشاء عميل Supabase بصلاحية Service Role (Admin)
 * ⚠️ هذا يتجاوز RLS بالكامل لذلك يجب استخدامه فقط في السيرفر
 */
function getAdminSupabase() {
  const config = getServerConfig();
  const serviceRole =
    config.supabaseServiceRole ?? process.env.SUPABASE_SERVICE_ROLE;

  const SUPABASE_URL = process.env.SUPABASE_URL;

  if (!serviceRole)
    throw new Error("Missing SUPABASE_SERVICE_ROLE in server environment");

  if (!SUPABASE_URL)
    throw new Error("Missing SUPABASE_URL in server environment");

  return createClient<Database>(SUPABASE_URL, serviceRole, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * =========================
 * CREATE USER (NEW VERSION)
 * =========================
 *
 * الفكرة:
 * - إنشاء المستخدم في auth.users
 * - trigger (handle_new_user) ينشئ profile تلقائياً
 * - لا نقوم بأي UPDATE على profiles هنا لتجنب:
 *   ❌ duplicate audit logs
 *   ❌ updated_at noise
 *   ❌ UPDATE غير ضروري
 */
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

    // تحويل username إلى email إذا لم يتم إدخال email صريح
    const resolvedEmail =
      data.email ?? resolveAuthEmail(data.username).email;

    if (!resolvedEmail) {
      throw new Error("Email is required for creating a user");
    }

    /**
     * 1) التأكد أن username غير مكرر
     */
    const { data: existingProfile, error: existingError } = await client
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingProfile) throw new Error("Username already exists");

    /**
     * 2) إنشاء المستخدم في Supabase Auth
     * ⬇️ هذا سيشغل trigger:
     *    handle_new_user()
     *    → INSERT INTO profiles
     */
    const { data: created, error: createError } =
      await client.auth.admin.createUser({
        email: resolvedEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          username: data.username,
          full_name: data.full_name ?? data.username,
        },
      });

    if (createError) throw createError;
    if (!created.user?.id)
      throw new Error("Missing user id from Supabase");

    const userId = created.user.id;

    /**
     * ❌ IMPORTANT CHANGE:
     * تم حذف هذا بالكامل:
     *
     * await client.from("profiles").update(...)
     *
     * السبب:
     * - handle_new_user ينشئ profile أصلاً
     * - هذا التحديث كان يسبب:
     *   → UPDATE إضافي
     *   → audit log غير ضروري
     *   → updated_at noise
     */

    /**
     * 3) تفعيل/حظر المستخدم (اختياري)
     */
    if (data.is_active === false) {
      const { error: banError } =
        await client.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });

      if (banError) throw banError;
    }

    return {
      user: {
        id: userId,
        email: resolvedEmail,
        username: data.username,
        full_name: data.full_name ?? null,
      },
    };
  });

/**
 * =========================
 * UPDATE USER
 * =========================
 *
 * هنا التحديث منطقي لأنه:
 * - تعديل بيانات مستخدم موجود
 * - وبالتالي audit logs مفيدة
 */
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

    /**
     * 1) تحديث auth.users (email / metadata / ban status)
     */
    const updatePayload: Record<string, unknown> = {};

    if (email) updatePayload.email = email;

    const userMetadata: Record<string, unknown> = {};

    if (username) userMetadata.username = username;
    if (full_name !== undefined) userMetadata.full_name = full_name;

    if (Object.keys(userMetadata).length) {
      updatePayload.user_metadata = userMetadata;
    }

    if (typeof is_active === "boolean") {
      updatePayload.ban_duration = is_active ? "none" : "876000h";
    }

    if (Object.keys(updatePayload).length) {
      const { error } = await client.auth.admin.updateUserById(
        userId,
        updatePayload as any
      );
      if (error) throw error;
    }

    /**
     * 2) تحديث profile (هذا هو المكان الوحيد الآن)
     * ⬇️ هذا التحديث هو الذي يولد audit UPDATE
     */
    const profileUpdate: any = {};

    if (username) profileUpdate.username = username;
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (typeof is_active === "boolean") profileUpdate.is_active = is_active;

    if (Object.keys(profileUpdate).length) {
      const { data, error } = await client
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId)
        .select()
        .maybeSingle();

      if (error) throw error;

      return { profile: data };
    }

    return { ok: true };
  });

/**
 * =========================
 * DELETE USER
 * =========================
 */
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId } = data;

    // حذف الصلاحيات أولاً
    const perms = await client
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);

    if (perms.error) throw perms.error;

    // حذف profile
    const prof = await client
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (prof.error) throw prof.error;

    // حذف المستخدم من auth
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { ok: true };
  });

/**
 * =========================
 * RESET PASSWORD
 * =========================
 */
export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const client = getAdminSupabase();
    const { userId } = data;

    const { data: userResult, error } =
      await client.auth.admin.getUserById(userId);

    if (error) throw error;

    const email = userResult.user?.email;
    if (!email) throw new Error("User has no email");

    const { error: resetError } =
      await client.auth.resetPasswordForEmail(email);

    if (resetError) throw resetError;

    return { ok: true };
  });

export default {};