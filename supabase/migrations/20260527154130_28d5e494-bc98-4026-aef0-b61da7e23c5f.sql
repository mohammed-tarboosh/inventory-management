
-- =====================================================
-- PROFILES & PERMISSIONS
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE public.permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.permission_group_items (
  group_id UUID NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_key)
);

CREATE TABLE public.user_permissions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE public.user_permission_groups (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- Security definer permission check
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_key = _permission
  ) OR EXISTS (
    SELECT 1 FROM public.user_permission_groups upg
    JOIN public.permission_group_items pgi ON pgi.group_id = upg.group_id
    WHERE upg.user_id = _user_id AND pgi.permission_key = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_permission(_user_id, 'system.admin');
$$;

-- =====================================================
-- LOOKUP TABLES
-- =====================================================

CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  rate_to_base NUMERIC(18, 6) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency_code, rate_date)
);

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ITEMS
-- =====================================================

CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  last_purchase_price_local NUMERIC(18, 4) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_category ON public.items(category_id);
CREATE INDEX idx_items_name_ar ON public.items(name_ar);

-- =====================================================
-- SUPPLIERS & CUSTOMERS
-- =====================================================

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PURCHASE INVOICES
-- =====================================================

CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'credit')),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  total_foreign NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_local NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_date ON public.purchase_invoices(invoice_date);
CREATE INDEX idx_invoices_supplier ON public.purchase_invoices(supplier_id);

CREATE TABLE public.purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  price_foreign NUMERIC(18, 4) DEFAULT 0,
  price_local NUMERIC(18, 4) NOT NULL,
  line_total_local NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON public.purchase_invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_item ON public.purchase_invoice_items(item_id);

-- =====================================================
-- STOCK MOVEMENTS
-- =====================================================

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'adjustment', 'opening')),
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price_local NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_table TEXT,
  reference_id UUID,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_item ON public.stock_movements(item_id);
CREATE INDEX idx_movements_date ON public.stock_movements(movement_date);

-- =====================================================
-- DEBT TRANSACTIONS
-- =====================================================

CREATE TABLE public.debt_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  amount NUMERIC(18, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  amount_local NUMERIC(18, 4) NOT NULL,
  invoice_ref TEXT,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debt_customer ON public.debt_transactions(customer_id);
CREATE INDEX idx_debt_date ON public.debt_transactions(transaction_date);

-- =====================================================
-- AUDIT LOG
-- =====================================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  diff JSONB
);

CREATE INDEX idx_audit_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_date ON public.audit_logs(changed_at);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_group_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES — All authenticated can read; permission-gated writes
-- =====================================================

-- Profiles
CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'users.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'users.manage'));

-- Permissions catalog (read-only)
CREATE POLICY "auth read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- Permission groups
CREATE POLICY "auth read pgroups" ON public.permission_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage pgroups" ON public.permission_groups FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'permissions.manage'));

CREATE POLICY "auth read pgi" ON public.permission_group_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage pgi" ON public.permission_group_items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'permissions.manage'));

CREATE POLICY "auth read up" ON public.user_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage up" ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'permissions.manage'));

CREATE POLICY "auth read upg" ON public.user_permission_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage upg" ON public.user_permission_groups FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'permissions.manage'));

-- Helper to make generic policies
-- Generic read for everyone authenticated, perm-gated for writes
DO $$
DECLARE
  t TEXT;
  p_view TEXT;
  p_manage TEXT;
BEGIN
  FOR t, p_view, p_manage IN
    SELECT * FROM (VALUES
      ('currencies', 'settings.view', 'settings.manage'),
      ('exchange_rates', 'settings.view', 'settings.manage'),
      ('units', 'settings.view', 'settings.manage'),
      ('categories', 'items.view', 'items.manage'),
      ('items', 'items.view', 'items.manage'),
      ('suppliers', 'suppliers.view', 'suppliers.manage'),
      ('customers', 'customers.view', 'customers.manage'),
      ('purchase_invoices', 'invoices.view', 'invoices.manage'),
      ('purchase_invoice_items', 'invoices.view', 'invoices.manage'),
      ('stock_movements', 'items.view', 'invoices.manage'),
      ('debt_transactions', 'debts.view', 'debts.manage'),
      ('audit_logs', 'reports.view', 'system.admin')
    ) AS x(t, v, m)
  LOOP
    EXECUTE format('CREATE POLICY "auth read %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "perm write %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), %L))', t, t, p_manage);
    EXECUTE format('CREATE POLICY "perm update %I" ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), %L)) WITH CHECK (public.has_permission(auth.uid(), %L))', t, t, p_manage, p_manage);
    EXECUTE format('CREATE POLICY "perm delete %I" ON public.%I FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), %L))', t, t, p_manage);
  END LOOP;
END $$;

-- =====================================================
-- SEED DATA
-- =====================================================

INSERT INTO public.permissions (key, label_ar, label_en, category) VALUES
  ('system.admin', 'مسؤول النظام', 'System Admin', 'system'),
  ('users.manage', 'إدارة المستخدمين', 'Manage Users', 'users'),
  ('permissions.manage', 'إدارة الصلاحيات', 'Manage Permissions', 'users'),
  ('settings.view', 'عرض الإعدادات', 'View Settings', 'settings'),
  ('settings.manage', 'إدارة الإعدادات', 'Manage Settings', 'settings'),
  ('items.view', 'عرض الأصناف', 'View Items', 'items'),
  ('items.manage', 'إدارة الأصناف', 'Manage Items', 'items'),
  ('items.import', 'استيراد أصناف من Excel', 'Import Items', 'items'),
  ('suppliers.view', 'عرض الموردين', 'View Suppliers', 'suppliers'),
  ('suppliers.manage', 'إدارة الموردين', 'Manage Suppliers', 'suppliers'),
  ('customers.view', 'عرض العملاء', 'View Customers', 'customers'),
  ('customers.manage', 'إدارة العملاء', 'Manage Customers', 'customers'),
  ('invoices.view', 'عرض الفواتير', 'View Invoices', 'invoices'),
  ('invoices.manage', 'إدارة الفواتير', 'Manage Invoices', 'invoices'),
  ('debts.view', 'عرض كشوف الحسابات', 'View Debts', 'debts'),
  ('debts.manage', 'إدارة الديون والقبض', 'Manage Debts', 'debts'),
  ('reports.view', 'عرض التقارير', 'View Reports', 'reports'),
  ('reports.export', 'تصدير التقارير', 'Export Reports', 'reports');

INSERT INTO public.currencies (code, name_ar, name_en, symbol, is_base) VALUES
  ('YER', 'ريال يمني', 'Yemeni Rial', 'ر.ي', true),
  ('USD', 'دولار أمريكي', 'US Dollar', '$', false),
  ('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', false);

INSERT INTO public.exchange_rates (currency_code, rate_to_base, rate_date) VALUES
  ('YER', 1, CURRENT_DATE),
  ('USD', 535, CURRENT_DATE),
  ('SAR', 142, CURRENT_DATE);

INSERT INTO public.units (name_ar, name_en) VALUES
  ('قطعة', 'Piece'),
  ('كرتون', 'Carton'),
  ('كيلوغرام', 'Kilogram'),
  ('لتر', 'Liter'),
  ('متر', 'Meter');

INSERT INTO public.permission_groups (name, description) VALUES
  ('admin', 'صلاحيات كاملة'),
  ('manager', 'مدير - كل العمليات عدا إدارة المستخدمين'),
  ('data_entry', 'إدخال البيانات والفواتير'),
  ('viewer', 'عرض فقط');

-- Seed group permissions
INSERT INTO public.permission_group_items (group_id, permission_key)
SELECT g.id, p.key FROM public.permission_groups g, public.permissions p WHERE g.name = 'admin';

INSERT INTO public.permission_group_items (group_id, permission_key)
SELECT g.id, p.key FROM public.permission_groups g, public.permissions p
WHERE g.name = 'manager' AND p.key NOT IN ('system.admin', 'users.manage', 'permissions.manage');

INSERT INTO public.permission_group_items (group_id, permission_key)
SELECT g.id, p.key FROM public.permission_groups g, public.permissions p
WHERE g.name = 'data_entry' AND p.key IN (
  'items.view', 'items.manage', 'items.import',
  'suppliers.view', 'suppliers.manage',
  'customers.view', 'customers.manage',
  'invoices.view', 'invoices.manage',
  'debts.view', 'debts.manage',
  'settings.view', 'reports.view'
);

INSERT INTO public.permission_group_items (group_id, permission_key)
SELECT g.id, p.key FROM public.permission_groups g, public.permissions p
WHERE g.name = 'viewer' AND p.key IN (
  'items.view', 'suppliers.view', 'customers.view',
  'invoices.view', 'debts.view', 'reports.view', 'settings.view'
);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'categories', 'items', 'suppliers', 'customers',
    'purchase_invoices', 'debt_transactions'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Auto-create profile + first user gets admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_count INT;
  v_admin_group UUID;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username, full_name)
  VALUES (NEW.id, v_username, COALESCE(NEW.raw_user_meta_data->>'full_name', v_username));

  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 1 THEN
    SELECT id INTO v_admin_group FROM public.permission_groups WHERE name = 'admin';
    IF v_admin_group IS NOT NULL THEN
      INSERT INTO public.user_permission_groups (user_id, group_id) VALUES (NEW.id, v_admin_group);
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate stock movements + update last price on invoice item insert
CREATE OR REPLACE FUNCTION public.on_invoice_item_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.purchase_invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_invoice FROM public.purchase_invoices WHERE id = NEW.invoice_id;

  INSERT INTO public.stock_movements (
    item_id, movement_type, quantity, unit_price_local,
    reference_table, reference_id, movement_date, created_by
  ) VALUES (
    NEW.item_id, 'purchase', NEW.quantity, NEW.price_local,
    'purchase_invoices', NEW.invoice_id, v_invoice.invoice_date, v_invoice.created_by
  );

  UPDATE public.items
    SET last_purchase_price_local = NEW.price_local, updated_at = now()
    WHERE id = NEW.item_id;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoice_item_stock
  AFTER INSERT ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.on_invoice_item_change();

-- Remove stock movements when invoice item deleted
CREATE OR REPLACE FUNCTION public.on_invoice_item_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.stock_movements
  WHERE reference_table = 'purchase_invoices'
    AND reference_id = OLD.invoice_id
    AND item_id = OLD.item_id;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_invoice_item_stock_del
  BEFORE DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.on_invoice_item_delete();

-- Compute amount_local on debt transactions
CREATE OR REPLACE FUNCTION public.compute_debt_local()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount_local := NEW.amount * NEW.exchange_rate;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_debt_local
  BEFORE INSERT OR UPDATE ON public.debt_transactions
  FOR EACH ROW EXECUTE FUNCTION public.compute_debt_local();

-- View for current stock quantities
CREATE OR REPLACE VIEW public.item_stock AS
SELECT
  i.id AS item_id,
  i.code,
  i.name_ar,
  i.name_en,
  i.category_id,
  i.unit_id,
  i.last_purchase_price_local,
  COALESCE(SUM(sm.quantity), 0) AS current_quantity,
  COALESCE(SUM(sm.quantity), 0) * i.last_purchase_price_local AS stock_value
FROM public.items i
LEFT JOIN public.stock_movements sm ON sm.item_id = i.id
GROUP BY i.id;

GRANT SELECT ON public.item_stock TO authenticated;

-- Customer balance view
CREATE OR REPLACE VIEW public.customer_balances AS
SELECT
  c.id AS customer_id,
  c.name,
  c.phone,
  COALESCE(SUM(CASE WHEN dt.transaction_type = 'debit' THEN dt.amount_local ELSE 0 END), 0) AS total_debit,
  COALESCE(SUM(CASE WHEN dt.transaction_type = 'credit' THEN dt.amount_local ELSE 0 END), 0) AS total_credit,
  COALESCE(SUM(CASE WHEN dt.transaction_type = 'debit' THEN dt.amount_local ELSE -dt.amount_local END), 0) AS balance
FROM public.customers c
LEFT JOIN public.debt_transactions dt ON dt.customer_id = c.id
GROUP BY c.id;

GRANT SELECT ON public.customer_balances TO authenticated;
