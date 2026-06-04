-- Migration: ensure audit trigger reads the correct JWT claim setting
-- and supports a custom GUC `audit.changed_by` as a fallback.
-- This helps populate `changed_by` when DB writes come from different contexts
-- (client requests, server functions using service-role, or other agents).

CREATE OR REPLACE FUNCTION public.audit_log_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid;
  old_json jsonb;
  new_json jsonb;
  action_name text := lower(TG_OP);
  record_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    actor_id := COALESCE(
      NULLIF(new_json ->> 'updated_by', '')::uuid,
      NULLIF(new_json ->> 'created_by', '')::uuid,
      NULLIF(current_setting('request.jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('audit.changed_by', true), '')::uuid
    );
    record_id := CASE
      WHEN new_json ? 'id' THEN NULLIF(new_json ->> 'id', '')::uuid
      ELSE NULL
    END;

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      record_id,
      action_name,
      actor_id,
      jsonb_build_object(
        'before', NULL,
        'after', new_json,
        'changes', public.audit_log_diff('{}'::jsonb, new_json)
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    actor_id := COALESCE(
      NULLIF(new_json ->> 'updated_by', '')::uuid,
      NULLIF(new_json ->> 'created_by', '')::uuid,
      NULLIF(current_setting('request.jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('audit.changed_by', true), '')::uuid
    );
    record_id := CASE
      WHEN new_json ? 'id' THEN NULLIF(new_json ->> 'id', '')::uuid
      ELSE NULL
    END;

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      record_id,
      action_name,
      actor_id,
      jsonb_build_object(
        'before', old_json,
        'after', new_json,
        'changes', public.audit_log_diff(old_json, new_json)
      )
    );
    RETURN NEW;
  ELSE
    old_json := to_jsonb(OLD);
    actor_id := COALESCE(
      NULLIF(old_json ->> 'updated_by', '')::uuid,
      NULLIF(old_json ->> 'created_by', '')::uuid,
      NULLIF(current_setting('request.jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('jwt.claims.sub', true), '')::uuid,
      NULLIF(current_setting('audit.changed_by', true), '')::uuid
    );
    record_id := CASE
      WHEN old_json ? 'id' THEN NULLIF(old_json ->> 'id', '')::uuid
      ELSE NULL
    END;

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      record_id,
      action_name,
      actor_id,
      jsonb_build_object(
        'before', old_json,
        'after', NULL,
        'changes', public.audit_log_diff(old_json, '{}'::jsonb)
      )
    );
    RETURN OLD;
  END IF;
END;
$function$;

-- NOTE: After applying this migration, update any server-side admin code that
-- performs direct DB writes with the service role to either:
--  - include `created_by`/`updated_by` in inserted/updated rows, OR
--  - set the session-level GUC `audit.changed_by` for the connection before
--    performing the write: `SELECT set_config('audit.changed_by', '<uuid>', false);`
