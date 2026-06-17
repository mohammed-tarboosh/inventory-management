# Environment Variables

يستخدم المشروع متغيرات بيئة للعميل والخادم. بعض المتغيرات تُحقن في جانب العميل عبر Vite، والبعض الآخر خاص بالخادم فقط.

## متغيرات العميل

- `VITE_SUPABASE_URL` — عنوان مشروع Supabase للعميل.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — المفتاح القابل للنشر للعميل.
- `VITE_SUPABASE_PROJECT_ID` — معرف المشروع المحلي/السحابي.

## متغيرات الخادم

- `SUPABASE_URL` — عنوان مشروع Supabase للخادم.
- `SUPABASE_SERVICE_ROLE_KEY` — مفتاح service role للخادم فقط.
- `SUPABASE_SERVICE_ROLE` — اسم بديل قد يظهر في الإعدادات القديمة؛ يُستخدم كـ fallback فقط.

## ملاحظات مهمة

- لا تضف `SUPABASE_SERVICE_ROLE_KEY` إلى الكود العميل أو إلى ملف `.env` المرفوع إلى المستودع.
- الكود الآن يفضّل `SUPABASE_SERVICE_ROLE_KEY` ويستخدم `SUPABASE_SERVICE_ROLE` كبديل فقط إذا كان الأول غير موجوداً.
- `NODE_ENV` عادةً ما تكون `development` أو `production`.

## مثال `.env.local` محلي

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=inventory-management
NODE_ENV=development
```

إذا كنت تحتاج إلى مفتاح service role في بيئة CI أو خادم، خزّنه فقط في إعدادات البيئة الخاصة بالخادم ولا تضعه في التخزين المشترك.

## الملاحظة المحلية

- تم تهيئة المشروع المحلي على `project_id = inventory-management` حسب `supabase/config.toml`.
