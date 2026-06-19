# Deployment — بناء ونشر

ملاحظات عامة:

- المشروع SSR باستخدام TanStack Start؛ يمكن استهداف بيئات Edge (Cloudflare) أو Node-based servers.

خطوات بناء أساسية:

```bash
npm run build
```

لـ preview محلي:

```bash
npm run preview
```

نصائح للنشر:

- إذا كنت تنشر على Cloudflare Workers/Pages: استخدم تكوينات البناء الخاصة بـ Vite والنشر لبيئة edge. راجع `src/server.ts` و`start.ts` للتأكد من أن handler متوافق مع runtime.
- لا تنشر `SUPABASE_SERVICE_ROLE_KEY` في متغيرات client؛ خزّنها كسِرّ في إعدادات المشروع على المنصة المقصودة.
- إعداد RLS وسياسات الصلاحيات يجب أن يتم عبر Supabase project قبل الربط.
