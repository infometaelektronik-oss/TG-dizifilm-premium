-- 1) Karantina alanları
ALTER TABLE public.user_streams
  ADD COLUMN IF NOT EXISTS quarantine_reason text,
  ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

-- Yeni kayıtlar varsayılan olarak karantinaya düşsün
ALTER TABLE public.user_streams ALTER COLUMN is_active SET DEFAULT false;

-- 2) Admin atama: husehus92@gmail.com (auth.users'tan bul)
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'husehus92@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 3) user_streams üzerinde admin yönetim politikaları (sadece adminler INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Admins manage user streams" ON public.user_streams;
CREATE POLICY "Admins manage user streams"
  ON public.user_streams FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Karantinadaki içerikler admin'e görünsün (anon için zaten is_active=true filtreli policy var)
DROP POLICY IF EXISTS "Admins see all streams" ON public.user_streams;
CREATE POLICY "Admins see all streams"
  ON public.user_streams FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5) Sistem durumu için RPC (ucuz sayım, anon erişimli)
CREATE OR REPLACE FUNCTION public.get_system_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_count', (SELECT count(*) FROM public.user_streams WHERE is_active = true),
    'quarantine_count', (SELECT count(*) FROM public.user_streams WHERE is_active = false),
    'last_check_at', (SELECT max(last_checked_at) FROM public.user_streams)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_system_status() TO anon, authenticated;