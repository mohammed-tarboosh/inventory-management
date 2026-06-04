-- Add actor columns to permission link tables so client writes can be attributed
-- and the schema cache matches the fields used by the UI.

ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.user_permission_groups
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
