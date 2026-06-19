-- Admin-side database wrappers so service-role writes can run in one transaction
-- with audit.changed_by set inside the database session.

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_actor_id uuid,
  p_username text,
  p_full_name text,
  p_is_active boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_profile public.profiles;
BEGIN
  PERFORM set_config('audit.changed_by', p_actor_id::text, false);

  UPDATE public.profiles
  SET
    username = COALESCE(p_username, username),
    full_name = COALESCE(p_full_name, full_name),
    is_active = COALESCE(p_is_active, is_active),
    updated_by = p_actor_id,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO updated_profile;

  RETURN updated_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(
  p_user_id uuid,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('audit.changed_by', p_actor_id::text, false);

  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$function$;
