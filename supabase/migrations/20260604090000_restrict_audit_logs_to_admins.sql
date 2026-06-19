-- =====================================================
-- RESTRICT AUDIT LOGS TO SYSTEM ADMINS
-- =====================================================

DROP POLICY IF EXISTS "auth read audit_logs" ON public.audit_logs;

CREATE POLICY "auth read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'system.admin'));