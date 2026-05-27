# نظام إدارة المخزون والحسابات

تطبيق ويب (PWA قابل للتثبيت) ثنائي اللغة (عربي RTL / إنجليزي LTR) مبني على TanStack Start + Lovable Cloud.

## الوحدات الرئيسية

### 1) الأصناف والمجموعات

- إدارة مجموعات الأصناف (شجرية بسيطة: مجموعة/مجموعة فرعية).
- إدارة الأصناف: رقم الصنف، الاسم، المجموعة، الوحدة، الكمية الحالية (محسوبة من الحركة)، آخر سعر شراء، صورة اختيارية.
- استيراد من Excel (xlsx) مع معاينة وتحقق قبل الحفظ، وتصدير قائمة الأصناف.
- تتبع: من أضاف / آخر من عدّل / تاريخ الإضافة / تاريخ التعديل (audit logs).

### 2) العملات وأسعار الصرف

- ثلاث عملات: ريال يمني (YR) كعملة محلية افتراضية، دولار أمريكي (USD)، ريال سعودي (SR).
- جدول `currencies` + جدول `exchange_rates` بأسعار صرف بتاريخ (يمكن إضافة سعر يومي).
- عند إدخال الفاتورة: اختيار العملة + سعر الصرف (يُقترح أحدث سعر تلقائياً، قابل للتعديل) + احتساب السعر المحلي تلقائياً.

### 3) فواتير المشتريات

- رأس الفاتورة: رقم، تاريخ، تاجر/مورد، نقدي/آجل، عملة، سعر صرف، ملاحظات.
- بنود الفاتورة: صنف، كمية، سعر بالعملة الأجنبية (إن وجد)، السعر المحلي المحسوب، الإجمالي.
- حفظ من أدخل ومن عدّل ومتى لكل فاتورة.
- عند الحفظ تُولَّد حركات مخزنية (`stock_movements`) تلقائياً.

### 4) الموردون (التجار)

- إدارة قائمة الموردين (اسم، هاتف، ملاحظات) لاستخدامهم في الفواتير وكشف الحساب.

### 5) حركة الأصناف (Timeline)

- شاشة استعراض الحركة مع فلاتر: صنف معين / مجموعة / مورد / فترة من-إلى / نوع الحركة.
- يعرض: التاريخ، نوع الحركة (شراء/تعديل)، الكمية، السعر، الفاتورة المرجعية، المورد، المدخل/المعدّل.
- لكل صنف: زر "عرض السجل" يفتح Timeline خاص بهذا الصنف مع جميع أسعار الشراء التاريخية.

### 6) كشف الحساب والديون (العملاء)

- إدارة العملاء.
- إدخال يدوي لحركات الذمم: دين علينا / دين لنا، مرتبط اختيارياً برقم فاتورة.
- حركات قبض/دفع: مبلغ، تاريخ، عملة، ملاحظة.
- كشف حساب تفصيلي لكل عميل: مدين/دائن/الرصيد التراكمي، مع تصدير PDF/Excel.

### 7) التقارير

- تقرير الجرد الحالي (الكميات + آخر سعر + قيمة المخزون).
- تقرير حركة صنف / مجموعة خلال فترة.
- تقرير المشتريات حسب الفترة/المورد.
- تقرير كشف حساب عميل.
- كل التقارير قابلة للطباعة والتصدير Excel + PDF (مع دعم العربية في PDF).

### 8) المستخدمون والصلاحيات (تفصيلية)

- مصادقة باسم المستخدم/كلمة المرور.
- نظام صلاحيات مرن:
  - جدول `permissions` (قائمة بالصلاحيات مثل: `items.view`, `items.create`, `items.edit`, `items.delete`, `invoices.view`, `invoices.create`, `invoices.edit`, `invoices.delete`, `customers.view`, `customers.manage`, `debts.view`, `debts.manage`, `reports.view`, `users.manage`, `permissions.manage`).
  - جدول `permission_groups` (مجموعة صلاحيات قابلة لإعادة الاستخدام).
  - جدول `user_permissions` و `user_permission_groups`.
  - دالة `has_permission(user_id, perm)` SECURITY DEFINER تستخدم في RLS وفي الواجهة.
- شاشة إدارة المستخدمين: تعيين/إزالة صلاحيات فردية أو ربط بمجموعة صلاحيات.
- إخفاء/تعطيل عناصر الواجهة حسب الصلاحية + حماية على مستوى الباك إند (RLS + server functions).

### 9) ثنائية اللغة

- i18n بسيط (ملفات `ar.json` / `en.json`) + `dir="rtl"` ديناميكي.
- زر تبديل اللغة في الهيدر، تذكّر الاختيار في localStorage.
- خط مناسب للعربية (Cairo/IBM Plex Sans Arabic).

### 10) PWA

- ملف manifest + service worker + أيقونات → قابل للتثبيت كتطبيق على الموبايل/الديسكتوب.

## البنية التقنية

- الواجهة: React + TanStack Router + Tailwind + shadcn/ui.
- الباك إند: Lovable Cloud (Postgres + Auth + Storage) عبر `createServerFn`.
- التصدير:
  - Excel: مكتبة `xlsx` في المتصفح.
  - PDF: مكتبة `pdfmake` أو `jspdf` مع دعم خط عربي.
- استيراد Excel: `xlsx` لقراءة الملف ثم تحقق Zod ثم إدراج دفعي.

## مخطط قاعدة البيانات (مختصر)

```text
profiles(id, full_name, email, locale)
permissions(key, label_ar, label_en, description)
permission_groups(id, name, description)
permission_group_items(group_id, permission_key)
user_permissions(user_id, permission_key)
user_permission_groups(user_id, group_id)

categories(id, name_ar, name_en, parent_id, created_by, updated_by, ...)
units(id, name_ar, name_en)
currencies(code, name_ar, name_en, is_base)
exchange_rates(id, currency_code, rate_to_base, rate_date)

items(id, code, name_ar, name_en, category_id, unit_id,
      last_purchase_price_local, created_by, updated_by, created_at, updated_at)

suppliers(id, name, phone, notes, created_by, ...)
customers(id, name, phone, notes, created_by, ...)

purchase_invoices(id, invoice_no, invoice_date, supplier_id,
                  payment_type[cash|credit], currency_code, exchange_rate,
                  total_foreign, total_local, notes,
                  created_by, updated_by, created_at, updated_at)
purchase_invoice_items(id, invoice_id, item_id, quantity,
                       price_foreign, price_local, line_total_local)

stock_movements(id, item_id, movement_type, quantity, unit_price_local,
                reference_table, reference_id, movement_date, created_by)

debt_transactions(id, customer_id, type[debit|credit|payment|receipt],
                  amount, currency_code, exchange_rate, amount_local,
                  invoice_ref, notes, transaction_date,
                  created_by, updated_by, created_at, updated_at)

audit_logs(id, table_name, record_id, action, changed_by, changed_at, diff jsonb)
```

كل الجداول عليها RLS تعتمد على `has_permission(auth.uid(), '<perm>')`.

## خريطة الصفحات

```text
/                       لوحة تحكم (ملخصات)
/login
/items                  قائمة الأصناف + استيراد/تصدير
/items/new, /items/:id
/categories
/suppliers
/customers
/invoices               فواتير المشتريات
/invoices/new, /invoices/:id
/movements              حركة الأصناف (Timeline)
/items/:id/timeline
/debts                  كشوف الحسابات
/debts/:customerId
/reports                مركز التقارير
/users                  إدارة المستخدمين والصلاحيات
/settings               العملات وأسعار الصرف، اللغة
```

## مراحل التنفيذ (داخلياً، تُبنى دفعة واحدة كما طلبت)

1. تفعيل Lovable Cloud + المصادقة + جداول الصلاحيات والـ RLS.
2. الإعدادات: العملات وأسعار الصرف، المجموعات، الوحدات، الموردون، العملاء.
3. الأصناف (CRUD + استيراد/تصدير Excel + audit).
4. فواتير المشتريات + توليد حركات المخزون.
5. شاشة الحركة (Timeline) + سجل صنف.
6. الديون وكشف الحساب.
7. التقارير + تصدير PDF/Excel.
8. إدارة المستخدمين والصلاحيات التفصيلية + شاشات الإدارة.
9. ثنائية اللغة الكاملة + RTL + PWA.

## نقاط أحتاج تأكيدك عليها قبل البدء

- العملة الأساسية للحسابات والتقارير: **ريال يمني (YER)** هل هذا صحيح؟ نعم ريال يمني وسعر الصرف 535
- هل تريد ربط الموردين بكشف الحساب أيضاً (وليس العملاء فقط)؟ لا العملاء فقط 
- هل تكفي مصادقة بالبريد وكلمة المرور، أم تريد إضافة Google sign-in؟اريد اسم مستخدم وكلمة مرور ومع امكانية إضافة وحذف وتعديل المستخدمين من التطبيق

اضغط "تنفيذ الخطة" للبدء، أو أخبرني بأي تعديل.