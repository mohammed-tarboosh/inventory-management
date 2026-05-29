# Routes — خريطة المسارات

المسارات مبنية على الملفات ضمن `src/routes/`، مع تخطيط خاص للمنطقة المؤمّنة (`_authenticated`).

ملف → مسار (أهم الصفحات):

- `src/routes/index.tsx` — `/` (تحويل إلى `/dashboard` للمستخدمين المسجّلين).
- `src/routes/login.tsx` — `/login`.
- `src/routes/signup.tsx` — `/signup`.
- `src/routes/__root.tsx` — layout الجذر ويتضمّن استيراد `styles.css`.
- `src/routes/_authenticated.tsx` — layout المؤمّن، يركّب `AppSidebar` و`AppHeader`.

المسارات المؤمّنة (داخل `_authenticated`):

- `/dashboard` — `src/routes/_authenticated/dashboard.tsx`
- `/items` — `src/routes/_authenticated/items.tsx`
- `/categories` — `src/routes/_authenticated/categories.tsx`
- `/customers` — `src/routes/_authenticated/customers.tsx`
- `/invoices` — `src/routes/_authenticated/invoices.tsx`
- `/movements` — `src/routes/_authenticated/movements.tsx`
- `/reports` — `src/routes/_authenticated/reports.tsx`
- `/settings` — `src/routes/_authenticated/settings.tsx`
- `/suppliers` — `src/routes/_authenticated/suppliers.tsx`
- `/units` — `src/routes/_authenticated/units.tsx`
- `/debts` — `src/routes/_authenticated/debts.tsx`
- `/users` — `src/routes/_authenticated/users.tsx`

ملاحظات:

- عمليات الحماية (guard) تتم في `beforeLoad` أو middleware المرتبط بـ `_authenticated`، عبر `supabase.auth.getUser()` أو التحقق من صلاحيات المستخدم.
- راجع `routeTree.gen.ts` للمطابقة الدقيقة بين أسماء المسارات والملفات.
