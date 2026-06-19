-- =====================================================
-- AUDIT LOG READ ACCESS
-- =====================================================

DROP POLICY IF EXISTS "auth read audit_logs" ON public.audit_logs;

CREATE POLICY "auth read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (true);
