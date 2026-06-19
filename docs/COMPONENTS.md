# Components — المكونات المشتركة

المجلد الرئيسي: `src/components/`

مكونات بارزة:

- `AppHeader.tsx` — رأس التطبيق: عرض المستخدم، تسجيل الخروج، تبديل اللغة.
- `AppSidebar.tsx` — شريط جانبي يحتوي على روابط التنقل والمجموعات القائمة على الصلاحيات.
- `ConfirmDelete.tsx` — حوار تأكيد الحذف القابل لإعادة الاستخدام.
- `DataTable.tsx` — جدول بيانات عام لعرض القوائم مع دعم التصفية والصفحات.
- `PageHeader.tsx` — رأس لكل صفحة يعرض العنوان وأزرار الإجراءات.

طبقة UI primitives: `src/components/ui/`

- تحتوي على مكونات منخفضة المستوى مثل `button`, `input`, `select`, `dialog`, `table`, `sidebar`، معمّاة عبر Tailwind وRadix.

نصائح للمطورين:

- لإضافة مكون جديد قابل لإعادة الاستخدام، اتبع نمط الـ UI primitives لضمان التوافق مع الثيم والـ spacing.
- راجع صفحات CRUD في `src/routes/_authenticated/` كمراجع لاستخدام `DataTable` و`ConfirmDelete`.
