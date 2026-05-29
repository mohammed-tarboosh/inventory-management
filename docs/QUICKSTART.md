# Quickstart — تشغيل المشروع محلياً

1) متطلبات النظام:

- Node.js 18+ وnpm أو bun (المشروع مهيأ مع Vite + TypeScript).
- Supabase CLI (لتشغيل Supabase محلياً عبر Docker).

1) تثبيت الحزم:

```bash
npm install
```

1) إعداد متغيرات البيئة المحليّة (انظر `ENVIRONMENT.md`): أنشئ ملف `.env` أو استخدم `env.local` وأضف مفاتيح Supabase المطلوبة.

2) تشغيل Supabase المحلي:

```bash
supabase start
```

1) تشغيل وضع التطوير:

```bash
npm run dev
```

1) بناء نسخة الإنتاج محلياً:

```bash
npm run build
npm run preview
```

أوامر إضافية:

- `npm run lint` — فحص ESLint.
- `npm run format` — تشغيل Prettier لتنسيق الملفات.
- `supabase status` — التحقق من حالة حاويات Supabase المحلية.
- `supabase stop` — إيقاف البيئة المحلية.
