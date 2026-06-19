# API & Server Functions Reference

هذا المستند يصف واجهات برمجة التطبيقات الداخلية (server functions) ونمط الدعوة بينها وبين العميل.

## نظرة عامة

التطبيق يستخدم `createServerFn` من `@tanstack/react-start` لإنشاء دوال تعمل على الخادم ويمكن استدعاؤها من العميل بطريقة آمنة ومؤطرة. هذه الدوال تشغّل كـ server-only code داخل handler، مما يسمح باستيراد وحدات server-only (مثل مفاتيح `service_role` أو مكتبات لا يجب شحنها إلى العميل).

## دوال موجودة حاليا

- `getGreeting` — مثال توضيحي موجود في `src/lib/api/example.functions.ts`.
  - طريقة: POST
  - مدخلات: `{ name: string }` (مُحقّق عبر `zod`)
  - الاستخدام: يعيد كائن تحيّة مع حالة البيئة من الخادم.

## كيفية الاستدعاء من العميل

من العميل يمكنك استدعاء الدالة مباشرة كما في المثال داخل الملف:

```ts
// مثال client-side
const result = await getGreeting({ data: { name: "Ada" } });
console.log(result.greeting); // "Hello, Ada!"
```

ملاحظات:

- لا تحتاج إلى كتابة مسار HTTP يدوياً؛ TanStack Start يولّد كائنات client-side قابلة للاستدعاء عند استخدام `createServerFn`.
- الدالة ترسل الطلب إلى السيرفر عبر fetch داخلي وتُعيد الاستجابة المفككة.

## تفاصيل تقنية: ماذا يحدث عند الاستدعاء

1. عند استدعاء `getGreeting(...)` من العميل، تُنشأ طلبة HTTP POST إلى نقطة نهاية داخلية تُديرها TanStack Start.
2. قبل تنفيذ الـ handler، يتم تطبيق الـ middleware التي تم تسجيلها في `src/start.ts` مثل `auth-attacher` و`errorMiddleware`.
3. داخل الـ handler تستطيع استدعاء كود server-only (قراءة `process.env`, استخدام `SUPABASE_SERVICE_ROLE_KEY`, الوصول إلى قواعد البيانات الآمنة).

## المصادقة والـ middleware

- `auth-attacher` — يضيف Authorization header المستخرج من جلسة العميل إلى طلبات server functions التي تُجرى نيابة عن المستخدم.

Note: The legacy `auth-middleware` file was removed from the codebase; server functions rely on `auth-attacher` for attaching user tokens and use `supabaseAdmin` or server-side logic for admin operations. See `src/start.ts` and `src/integrations/supabase/auth-attacher.ts` for registration details.

## إضافة دالة خادم جديدة

1. أنشئ ملف جديد داخل `src/lib/api/` أو أضف إلى ملف موجود.
2. استخدم النمط التالي:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const myFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      /* ... */
    }),
  )
  .handler(async ({ data, ctx }) => {
    // كود server-only هنا
    return { ok: true };
  });
```

1. استدعِ `myFn({ data: { ... } })` من العميل.

ملاحظات أمان:

- ضع أي كود يعتمد على `SUPABASE_SERVICE_ROLE_KEY` داخل `.server.ts` أو داخل الـ handler فقط.
- تجنّب وضع مفاتيح سرية في ملفات تُشحن للعميل.

## نمط الرد والأخطاء

- عندما يرمي الـ handler خطأً، يتم تمرير خطأ HTTP مناسب إلى العميل — يمكنك معالجته عبر `try/catch` على جهة العميل.
- استخدم `zod` للتحقق من المدخلات لتقليل أخطاء التحقق على الخادم.

## تسجيل ونقاط نهاية HTTP التقليدية

التطبيق يعتمد بشكل أساسي على server functions بدلاً من بناء REST endpoints يدوياً. إن احتجت لواجهة REST/HTTP تقليدية، أضف handler في `src/server.ts` أو أنشئ وظائف edge مخصصة ودوّنها هنا.

---

إذا رغبت، أستطيع:

- توليد جدول تلقائي في هذا الملف لكل server function موجود (حصر جميع `createServerFn`).
- إضافة أمثلة استدعاء TypeScript مفصّلة لكل دالة.
