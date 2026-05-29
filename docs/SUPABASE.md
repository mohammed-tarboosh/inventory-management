# Supabase Integration

المجلد: `src/integrations/supabase/`

حالة البيئة المحلية الحالية:

- `project_id`: `inventory-management`
- `Project URL`: `http://127.0.0.1:54321`
- حاويات Docker تظهر بالبادئة: `supabase_*_inventory-management`

الملفات المهمة:

- `client.ts` — عميل Supabase للعميل (publishable key). يستخدم متغيرات `VITE_SUPABASE_*`.
- `client.server.ts` — عميل server/admin يستخدم `SUPABASE_SERVICE_ROLE_KEY` للعمليات الموثوقة.
- `auth-attacher.ts` — ميدلوير يضيف Authorization header لنداءات السيرفر استناداً إلى جلسة المستخدم.
- `auth-middleware.ts` — ميدلوير للتحقق من توكن Bearer في استدعاءات الخادم.
- `types.ts` — أنماط الجداول المولدة (generated) من schema.

ملاحظات أمان:

- لا تعرض `SUPABASE_SERVICE_ROLE_KEY` على العميل.
- استخدم العميل server فقط في بيئة موثوقة (server functions أو edge runtime الآمن).

قواعد عامة للتنفيذ:

- قراءة المستخدم الحالي: `supabase.auth.getUser()`.
- تسجيل الدخول: `supabase.auth.signInWithPassword()`.
- تسجيل الخروج: `supabase.auth.signOut()`.

RLS وPolicies:

- يحتوي المجلد `supabase/migrations/` على سياسات RLS لتقييد الوصول إلى الجداول حسب المستخدم/الصلاحيات.
- راجع `DB_MIGRATIONS.md` لمخطط الجداول والأهداف.

ملاحظة تشغيل محلي:

- إذا غيرت `project_id` في `supabase/config.toml`، أعد تشغيل البيئة المحلية (`supabase stop --all` ثم `supabase start`) حتى يتحدث اسم حاويات Docker ووسومها.
