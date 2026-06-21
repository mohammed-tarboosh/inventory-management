-- =====================================================
-- USER PROFILE AVATARS — migration
-- شغّله في Supabase SQL Editor
-- =====================================================

-- 1. إضافة عمود الصورة الشخصية لجدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =====================================================
-- Storage Bucket للصور الشخصية
-- =====================================================
-- من Supabase Dashboard: Storage > New Bucket
--   Name: avatars
--   Public bucket: ✅
--   Max file size: 2 MB
--   Allowed MIME types: image/jpeg, image/png, image/webp
--
-- أو عبر SQL (يحتاج service_role):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'avatars', 'avatars', true, 2097152,
--   ARRAY['image/jpeg','image/png','image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Storage Policies للـ avatars bucket
-- (بعد إنشاء الـ bucket من Dashboard)
-- =====================================================

-- قراءة عامة
-- CREATE POLICY "public read avatars"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');

-- كل مستخدم يرفع في مجلده الخاص فقط: avatars/{user_id}/
-- CREATE POLICY "user upload own avatar"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'avatars'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- المستخدم يحذف صورته فقط
-- CREATE POLICY "user delete own avatar"
--   ON storage.objects FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'avatars'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- المسؤول يحذف أي صورة
-- CREATE POLICY "admin delete avatars"
--   ON storage.objects FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'avatars'
--     AND public.has_permission(auth.uid(), 'users.manage')
--   );
