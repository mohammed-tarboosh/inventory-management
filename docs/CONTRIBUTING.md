# Contributing

قواعد عامة قبل فتح PR:

- اتبع قواعد التنسيق: `npm run format`.
- شغّل ESLint: `npm run lint` وتأكد من حل التحذيرات الحرجة.
- لا تعدّل الملفات المولدة آلياً (`src/routeTree.gen.ts`).

نمط الكود:

- استخدم TypeScript، تجنّب `any` حيثما أمكن.

إضافة ترحيل (migration):

- أنشئ ملف SQL جديد في `supabase/migrations/` مع طابع زمني واضح.
- توثيق التغييرات في `DB_MIGRATIONS.md` عند الحاجة.
