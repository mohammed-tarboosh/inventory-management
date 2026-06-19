-- =====================================================
-- PREVENT UPDATING currencies.code AFTER CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_currency_code_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'currency code cannot be changed once created (old=% , new=%)', OLD.code, NEW.code;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Attach trigger if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'currencies' AND t.tgname = 'prevent_currency_code_update'
  ) THEN
    CREATE TRIGGER prevent_currency_code_update BEFORE UPDATE ON public.currencies
      FOR EACH ROW EXECUTE FUNCTION public.prevent_currency_code_update();
  END IF;
END$$;
