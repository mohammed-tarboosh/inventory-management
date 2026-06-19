-- =====================================================
-- AUDIT LOG ACCESS + ACTOR RESOLUTION
-- =====================================================

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
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    actor_id := COALESCE(
      NULLIF(new_json ->> 'updated_by', '')::uuid,
      NULLIF(new_json ->> 'created_by', '')::uuid,
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    );

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
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

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
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

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
    VALUES (
      TG_TABLE_NAME,
      OLD.id,
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

DROP POLICY IF EXISTS "auth read audit_logs" ON public.audit_logs;
CREATE POLICY "auth read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'reports.view') OR public.has_permission(auth.uid(), 'system.admin'));
