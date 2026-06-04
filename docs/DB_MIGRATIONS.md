# Database Migrations

المجلد: `supabase/migrations/`

الملفات الحالية (موجز):

- `20260527154130_28d5e494-bc98-4026-aef0-b61da7e23c5f.sql` — ينشئ جداول رئيسية مثل `profiles`, `permissions`, `items`, `purchase_invoices`, `purchase_invoice_items`, `stock_movements`, `debt_transactions`, `customers`, `suppliers`, `units`, و`audit_logs`.
- `20260527154146_fe578b1d-13bf-48af-89ef-f855e3826fa3.sql` — دوال trigger مساعدة (`set_updated_at`, `compute_debt_local`) وتعديلات على views.
- `20260527154200_eac94170-1096-414c-b67b-c8325bb35c6d.sql` — منح وصلاحيات على دوال وإجراءات مخزنة.
- `20260604090000_restrict_audit_logs_to_admins.sql` — يقصر قراءة `audit_logs` على من يملك `system.admin`.
 - `20260604100000_prevent_currency_code_update.sql` — يمنع تعديل حقل المفتاح `code` في جدول `currencies` بعد إنشائه (يرفض UPDATE عند تغيير `code`).

Recent changes applied locally:

- Applied migration `20260604090000_restrict_audit_logs_to_admins.sql` that restricts `SELECT` on `public.audit_logs` to users with `system.admin` permission.
- Added and applied `20260604100000_prevent_currency_code_update.sql` to reject updates to `currencies.code` and protect FK integrity.

Verify locally:

- Run `supabase db reset` in local dev (or use Supabase UI) to reapply migrations on a fresh DB.
- Attempting to `UPDATE public.currencies SET code = 'NEW' WHERE code = 'OLD'` should raise an exception.

تشغيل الميغريشن محلياً:

- استخدم Supabase CLI أو لوحة Supabase لتطبيق هذه الملفات على البيئة المطلوبة.

نصيحة:

- لا تقم بتحرير ملفات الترحيل بعد نشرها في بيئة مشتركة؛ بدّل بالملف الجديد الذي يحتوي على تغييرات لاحقة.
