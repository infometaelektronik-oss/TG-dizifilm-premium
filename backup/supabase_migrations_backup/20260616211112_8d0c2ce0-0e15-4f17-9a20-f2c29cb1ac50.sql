
-- Dedupe first, then add unique constraint
DELETE FROM public.user_streams a
USING public.user_streams b
WHERE a.source_url = b.source_url
  AND a.created_at < b.created_at;

ALTER TABLE public.user_streams
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS referer text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS season integer,
  ADD COLUMN IF NOT EXISTS episode integer,
  ADD COLUMN IF NOT EXISTS series_title text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_streams_source_url_key'
  ) THEN
    ALTER TABLE public.user_streams
      ADD CONSTRAINT user_streams_source_url_key UNIQUE (source_url);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tg_tv_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  title text NOT NULL,
  description text,
  stream_url text NOT NULL,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tg_tv_schedule TO anon, authenticated;
GRANT ALL ON public.tg_tv_schedule TO service_role;
ALTER TABLE public.tg_tv_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read TG TV schedule" ON public.tg_tv_schedule;
CREATE POLICY "Anyone can read TG TV schedule" ON public.tg_tv_schedule FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage TG TV schedule" ON public.tg_tv_schedule;
CREATE POLICY "Admins manage TG TV schedule" ON public.tg_tv_schedule FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.archive_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_title text NOT NULL,
  season integer NOT NULL,
  episode integer NOT NULL,
  title text,
  stream_url text NOT NULL,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_title, season, episode)
);
GRANT SELECT ON public.archive_episodes TO anon, authenticated;
GRANT ALL ON public.archive_episodes TO service_role;
ALTER TABLE public.archive_episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read archive episodes" ON public.archive_episodes;
CREATE POLICY "Anyone can read archive episodes" ON public.archive_episodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage archive episodes" ON public.archive_episodes;
CREATE POLICY "Admins manage archive episodes" ON public.archive_episodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
