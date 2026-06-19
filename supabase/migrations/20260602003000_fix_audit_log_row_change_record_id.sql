-- Avoid assuming every audited table has an `id` column.
CREATE OR REPLACE FUNCTION public.audit_log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
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
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
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
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
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
$$;