# Environment Variables

يستخدم المشروع كل من متغيرات Vite للعميل والمتغيرات الخاصة بالخادم.

مطلوب (أمثلة):

- `VITE_SUPABASE_URL` — عنوان مشروع Supabase (client).
- `VITE_SUPABASE_PUBLISHABLE_KEY` — مفتاح قابل للنشر (client).
- `VITE_SUPABASE_PROJECT_ID` — معرف المشروع المحلي/السحابي المستخدم داخل التطبيق.
- `SUPABASE_URL` — عنوان Supabase لخدمات الخادم/الميدلوير.
- `SUPABASE_PUBLISHABLE_KEY` — مفتاح publishable على مستوى الخادم عند الحاجة.
- `SUPABASE_SERVICE_ROLE_KEY` — مفتاح service role (server-only، احفظه سرياً).
- `SUPABASE_SERVICE_ROLE` — (alias) service role key used by new server functions. Keep this secret and only set it in server/CI environments.
- `SUPABASE_SERVICE_ROLE_KEY` — (المسمي الرسمي) مفتاح service role للاستخدام على الخادم (server-only). احفظه سريًا.
- `SUPABASE_SERVICE_ROLE` — اسم بديل قد يظهر في الإعدادات القديمة؛ الآن مدعوم كـ fallback فقط ولكن يفضّل استخدام `SUPABASE_SERVICE_ROLE_KEY`.
Note on canonicalization:

- The codebase now prefers `SUPABASE_SERVICE_ROLE_KEY` and falls back to `SUPABASE_SERVICE_ROLE` only when the former is not present. See `src/lib/config.server.ts` for exact logic.
- `NODE_ENV` — `development` أو `production`.

ملاحظات:

- استخدم متغيرات تبدأ بـ `VITE_` ليتم حقنها في جانب العميل عبر Vite.
- لا تضف `SUPABASE_SERVICE_ROLE_KEY` إلى الكود العميل أو ملف `.env` المشهور علناً.

مثال `.env` محلي (لا تضف service role إلى مستودع عام):

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=inventory-management
# (Optional) legacy alias - supported as fallback:
SUPABASE_SERVICE_ROLE=sb_secret_xxx
NODE_ENV=development
```

ملاحظة للبيئة الحالية:

- تم تهيئة المشروع المحلي على `project_id = inventory-management`.
