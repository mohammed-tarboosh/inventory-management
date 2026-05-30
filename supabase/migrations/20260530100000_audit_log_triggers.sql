-- =====================================================
-- AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_log_diff(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  key_name text;
BEGIN
  FOR key_name IN
    SELECT DISTINCT key
    FROM (
      SELECT key FROM jsonb_each(COALESCE(old_row, '{}'::jsonb))
      UNION
      SELECT key FROM jsonb_each(COALESCE(new_row, '{}'::jsonb))
    ) keys
    ORDER BY key
  LOOP
    IF (COALESCE(old_row, '{}'::jsonb) -> key_name) IS DISTINCT FROM (COALESCE(new_row, '{}'::jsonb) -> key_name) THEN
      result := result || jsonb_build_array(
        jsonb_build_object(
          'field', key_name,
          'old', COALESCE(old_row, '{}'::jsonb) -> key_name,
          'new', COALESCE(new_row, '{}'::jsonb) -> key_name
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  old_json jsonb;
  new_json jsonb;
  action_name text := lower(TG_OP);
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
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

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles',
      'permissions',
      'permission_groups',
      'permission_group_items',
      'user_permissions',
      'user_permission_groups',
      'currencies',
      'exchange_rates',
      'units',
      'categories',
      'items',
      'suppliers',
      'customers',
      'purchase_invoices',
      'purchase_invoice_items',
      'stock_movements',
      'debt_transactions'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_log_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_log_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change()',
      t
    );
  END LOOP;
END $$;

-- Make audit logs read-only for authenticated users and keep writes internal.
DO $$
BEGIN
  DROP POLICY IF EXISTS "auth read audit_logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "perm write audit_logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "perm update audit_logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "perm delete audit_logs" ON public.audit_logs;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
