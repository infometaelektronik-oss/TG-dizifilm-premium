ALTER TABLE public.user_streams
  ADD COLUMN IF NOT EXISTS release_year int,
  ADD COLUMN IF NOT EXISTS imdb_rating numeric(3,1),
  ADD COLUMN IF NOT EXISTS cast_list text[],
  ADD COLUMN IF NOT EXISTS tmdb_id int,
  ADD COLUMN IF NOT EXISTS meta_enriched_at timestamptz;

CREATE TABLE public.watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.user_streams(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.watch_events TO service_role;
ALTER TABLE public.watch_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX watch_events_created_idx ON public.watch_events(created_at DESC);
CREATE INDEX watch_events_stream_idx ON public.watch_events(stream_id);

CREATE TABLE public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_key text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, series_key)
);
GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites read" ON public.user_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own favorites add" ON public.user_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favorites remove" ON public.user_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  stream_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_new_episode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN RETURN NEW; END IF;
  k := lower(trim(coalesce(NEW.series_title, NEW.title)));
  INSERT INTO public.notifications (user_id, title, body, stream_id)
  SELECT f.user_id, 'Yeni bölüm: ' || f.label,
         coalesce(NEW.title, '') ||
         CASE WHEN NEW.season IS NOT NULL THEN ' · S' || NEW.season ELSE '' END ||
         CASE WHEN NEW.episode IS NOT NULL THEN 'B' || NEW.episode ELSE '' END,
         NEW.id
  FROM public.user_favorites f WHERE f.series_key = k;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_new_episode() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_streams_notify_episode
AFTER INSERT OR UPDATE OF is_active ON public.user_streams
FOR EACH ROW EXECUTE FUNCTION public.notify_new_episode();