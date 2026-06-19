ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS default_currency TEXT REFERENCES public.currencies(code),
  ADD COLUMN IF NOT EXISTS default_payment_type TEXT NOT NULL DEFAULT 'cash';
