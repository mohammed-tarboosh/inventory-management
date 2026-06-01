-- Allow audit logs to have null `changed_by` for system actions
ALTER TABLE public.audit_logs ALTER COLUMN changed_by DROP NOT NULL;