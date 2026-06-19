# Troubleshooting & FAQ

مشاكل شائعة:

- خطأ: `Missing VITE_SUPABASE_URL` — تأكّد من وضع المتغيرات في `.env` ثم إعادة تشغيل السيرفر.
- مصادقة تفشل في الـ SSR — تأكّد من أن `auth-attacher` يُرمز بشكل صحيح وأن التوكن مُرسل في الطلبات.
- مشاكل CORS أو رسائل 401 من Supabase — راجع إعدادات RLS ومفاتيح الـ API المستخدمة (publishable vs service role).
- يظهر اسم مشروع Docker قديم (مثل `xhx...`) — أوقف الستاك القديم عبر:

```bash
supabase stop --project-id <old_project_id> --no-backup --yes
supabase start --yes
```

- خدمة `supabase_vector_*` في حالة `Restarting` على Windows — غالباً لا يؤثر على REST/Auth/DB محلياً. راجع حالة الخدمات بـ:

```bash
supabase status --output pretty
docker ps --format "table {{.Names}}\t{{.Status}}"
```

فحص السجلات:

- عند البناء أو تشغيل preview، راجع الـ console logs من Vite.
- عند تشغيل في بيئة Cloud/Edge: راجع سجلات الـ platform (Cloudflare logs أو السرفر المضيف).
