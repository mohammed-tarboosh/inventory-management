-- Create helper to set session-level audit.changed_by via RPC
CREATE OR REPLACE FUNCTION public.set_audit_changed_by(audit_uid uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
SELECT set_config('audit.changed_by', audit_uid::text, false);
$function$;

COMMENT ON FUNCTION public.set_audit_changed_by(uuid) IS 'Helper to set session audit.changed_by GUC for RPC calls from supabase-js via service role client.';
