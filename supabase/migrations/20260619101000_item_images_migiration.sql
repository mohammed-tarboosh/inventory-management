-- =====================================================
-- ITEM IMAGES MIGRATION
-- تشغيل هذا الملف في Supabase SQL Editor
-- =====================================================

-- 1. جدول الصور
CREATE TABLE public.item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,        -- المسار داخل bucket: items/{item_id}/{filename}
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_images_item ON public.item_images(item_id);

-- 2. تفعيل RLS
ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read item_images"
  ON public.item_images FOR SELECT TO authenticated USING (true);

CREATE POLICY "perm insert item_images"
  ON public.item_images FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'items.manage'));

CREATE POLICY "perm update item_images"
  ON public.item_images FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'items.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'items.manage'));

CREATE POLICY "perm delete item_images"
  ON public.item_images FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'items.manage'));

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_images TO authenticated;
GRANT ALL ON public.item_images TO service_role;

-- 4. trigger: صورة رئيسية واحدة فقط لكل صنف
CREATE OR REPLACE FUNCTION public.ensure_single_primary_image()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.item_images
      SET is_primary = false
      WHERE item_id = NEW.item_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_single_primary_image
  AFTER INSERT OR UPDATE ON public.item_images
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.ensure_single_primary_image();

-- =====================================================
-- Storage Bucket (نفّذ هذا بشكل منفصل أو من Dashboard)
-- =====================================================
-- من Supabase Dashboard: Storage > New Bucket
--   Name: item-images
--   Public bucket: ✅ (حتى تظهر الصور بدون authentication)
--
-- أو عبر SQL (يحتاج امتيازات service_role):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('item-images', 'item-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']);

-- Storage Policies (بعد إنشاء الـ bucket):
-- CREATE POLICY "public read item-images"
--   ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
--
-- CREATE POLICY "auth upload item-images"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'item-images'
--     AND public.has_permission(auth.uid(), 'items.manage'));
--
-- CREATE POLICY "auth delete item-images"
--   ON storage.objects FOR DELETE TO authenticated
--   USING (bucket_id = 'item-images'
--     AND public.has_permission(auth.uid(), 'items.manage'));
