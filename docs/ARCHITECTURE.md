# Architecture — بنية المشروع

نظرة عامة سريعة:

- إطار العمل: React + TanStack Start (SSR) + TanStack Router.
- الباندل: Vite + TypeScript.
- قاعدة البيانات: Supabase (Postgres) مع RLS وسياسات صلاحيات.

هيكل ملفات رئيسي:

- `src/start.ts` — إنشاء مثيل TanStack Start وتسجيل الميدلوير (middleware) مثل `auth-attacher` و`error middleware`.
- `src/server.ts` — مدخل SSR العام (export default fetch handler) المستخدم في بيئات edge/Cloudflare.
- `src/router.tsx` و`src/routeTree.gen.ts` — تكوين الراوتر والمسارات.
- `src/routes/` — صفحات التطبيق (file-based routing). يحتوي على `__root.tsx` و`_authenticated.tsx` للـ layout والـ guard.
- `src/components/` — مكونات مشتركة وطبقة UI (primitives) في `src/components/ui`.
- `src/integrations/supabase/` — تكوين عملاء Supabase، types المولدة، وmiddleware للمصادقة.
- `supabase/migrations/` — SQL migrations لتعريف الجداول، الاندكسات، والـ functions.

ملاحظات مهمة:

- يتم استخدام عميلين لـ Supabase: عميل للعميل (publishable key) وعميل admin/server (service role key) للعمليات الموثوقة.
- تجنّب تعديل `routeTree.gen.ts` لأنه مولد آلياً.
