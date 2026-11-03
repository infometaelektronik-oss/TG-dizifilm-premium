
-- Drop previous bespoke schema
DROP TABLE IF EXISTS public.link_checks CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.channel_kind CASCADE;
DROP TYPE IF EXISTS public.channel_status CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- Core table
CREATE TABLE IF NOT EXISTS public.user_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Live TV', 'Series', 'Movies', 'Radio')),
  stream_type TEXT NOT NULL CHECK (stream_type IN ('HLS', 'MP4', 'AUDIO')),
  poster_url TEXT,
  backdrop_url TEXT,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','active','degraded','dead')),
  last_checked_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_status_code INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_streams TO anon;
GRANT SELECT ON public.user_streams TO authenticated;
GRANT ALL ON public.user_streams TO service_role;

ALTER TABLE public.user_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active sources are visible to everyone" ON public.user_streams;
CREATE POLICY "Active sources are visible to everyone"
  ON public.user_streams FOR SELECT USING (is_active = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_user_streams_updated_at ON public.user_streams;
CREATE TRIGGER update_user_streams_updated_at
BEFORE UPDATE ON public.user_streams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_streams_category ON public.user_streams(category);
CREATE INDEX IF NOT EXISTS idx_user_streams_active_created
  ON public.user_streams(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_streams_status
  ON public.user_streams(status, last_checked_at);

-- Hourly link health cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('neon-link-check-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'neon-link-check-hourly',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--ephjckovwttuivppffjo.lovable.app/api/public/cron/check-links',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
