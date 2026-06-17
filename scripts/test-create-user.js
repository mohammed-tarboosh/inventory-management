const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment");
  process.exit(2);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE);

(async () => {
  try {
    const username = "salah";
    const password = "Password123!";
    const full_name = "صلاح الدين طرووش";
    const email = "salah@inv.local";

    console.log("Checking existing profile for", username);
    const { data: existingProfile, error: existingError } = await client
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    console.log("existingProfile:", existingProfile, "existingError:", existingError);
    if (existingError) throw existingError;
    if (existingProfile) {
      console.log("Username already exists, aborting.");
      process.exit(0);
    }

    console.log("Creating auth user via admin.createUser...");
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name },
    });
    console.log("createError:", createError);
    console.log("created:", created);
    if (createError) throw createError;
    if (!created || !created.user || !created.user.id)
      throw new Error("Missing user id in create response");

    const userId = created.user.id;
    console.log("Created user id:", userId);

    console.log("Updating profiles row with id =", userId);
    const profileUpdate = await client
      .from("profiles")
      .update({ username, full_name, is_active: true })
      .eq("id", userId)
      .select()
      .maybeSingle();
    console.log("profileUpdate:", profileUpdate);
    if (profileUpdate.error) throw profileUpdate.error;

    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err && err.message ? err.message : err);
    if (err && err.details) console.error("DETAILS:", err.details);
    if (err && err.hint) console.error("HINT:", err.hint);
    if (err && err.code) console.error("CODE:", err.code);
    process.exit(1);
  }
})();
