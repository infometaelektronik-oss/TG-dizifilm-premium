CREATE TABLE IF NOT EXISTS public.epg_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  channel_id text,
  channel_name text,
  stream_title_match text,
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  disabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epg_sources TO authenticated;
GRANT ALL ON public.epg_sources TO service_role;

ALTER TABLE public.epg_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage epg sources" ON public.epg_sources;
CREATE POLICY "Admins can manage epg sources"
ON public.epg_sources
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.epg_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.epg_sources(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_name text,
  stream_id uuid,
  title text NOT NULL,
  description text,
  category text,
  poster_url text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epg_programmes_time_order CHECK (end_at > start_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epg_programmes TO authenticated;
GRANT ALL ON public.epg_programmes TO service_role;

ALTER TABLE public.epg_programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage epg programmes" ON public.epg_programmes;
CREATE POLICY "Admins can manage epg programmes"
ON public.epg_programmes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_streams_active_sort ON public.user_streams (is_active, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_streams_health_queue ON public.user_streams (last_checked_at ASC NULLS FIRST, is_active, status);
CREATE INDEX IF NOT EXISTS idx_user_streams_category_active ON public.user_streams (category, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_epg_sources_enabled ON public.epg_sources (disabled, last_synced_at ASC NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_epg_programmes_window ON public.epg_programmes (channel_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_epg_programmes_stream_window ON public.epg_programmes (stream_id, start_at, end_at) WHERE stream_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_epg_programmes_unique_slot ON public.epg_programmes (source_id, channel_id, start_at, title);

DROP TRIGGER IF EXISTS update_epg_sources_updated_at ON public.epg_sources;
CREATE TRIGGER update_epg_sources_updated_at
BEFORE UPDATE ON public.epg_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_epg_programmes_updated_at ON public.epg_programmes;
CREATE TRIGGER update_epg_programmes_updated_at
BEFORE UPDATE ON public.epg_programmes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tg-check-links-every-hour') THEN
    PERFORM cron.unschedule('tg-check-links-every-hour');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tg-autonomous-scan-every-15m') THEN
    PERFORM cron.unschedule('tg-autonomous-scan-every-15m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tg-epg-sync-every-3h') THEN
    PERFORM cron.unschedule('tg-epg-sync-every-3h');
  END IF;
END $$;

SELECT cron.schedule(
  'tg-check-links-every-hour',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tgdizifilm.lovable.app/api/public/cron/check-links',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaGpja292d3R0dWl2cHBmZmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjcxNDUsImV4cCI6MjA5NzA0MzE0NX0.Cc08fBSWxa1tfuXvfxKNks2F3-DWLMLs0M82UnLN0uk"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'tg-autonomous-scan-every-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tgdizifilm.lovable.app/api/public/cron/autonomous-scan',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaGpja292d3R0dWl2cHBmZmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjcxNDUsImV4cCI6MjA5NzA0MzE0NX0.Cc08fBSWxa1tfuXvfxKNks2F3-DWLMLs0M82UnLN0uk"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'tg-epg-sync-every-3h',
  '12 */3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tgdizifilm.lovable.app/api/public/cron/sync-epg',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaGpja292d3R0dWl2cHBmZmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjcxNDUsImV4cCI6MjA5NzA0MzE0NX0.Cc08fBSWxa1tfuXvfxKNks2F3-DWLMLs0M82UnLN0uk"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);