
ALTER VIEW public.item_stock SET (security_invoker = true);
ALTER VIEW public.customer_balances SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.compute_debt_local()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.amount_local := NEW.amount * NEW.exchange_rate;
  RETURN NEW;
END $$;
