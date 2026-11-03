ALTER TABLE public.user_streams
  ADD COLUMN IF NOT EXISTS normalized_title text,
  ADD COLUMN IF NOT EXISTS ai_normalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS backup_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid,
  ADD COLUMN IF NOT EXISTS video_width integer,
  ADD COLUMN IF NOT EXISTS video_height integer,
  ADD COLUMN IF NOT EXISTS bitrate_kbps integer,
  ADD COLUMN IF NOT EXISTS fps numeric,
  ADD COLUMN IF NOT EXISTS quality_label text,
  ADD COLUMN IF NOT EXISTS quality_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS user_streams_normalized_title_idx ON public.user_streams (normalized_title);
CREATE INDEX IF NOT EXISTS user_streams_duplicate_of_idx ON public.user_streams (duplicate_of);

CREATE TABLE IF NOT EXISTS public.layout_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'row',
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.layout_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_sections TO authenticated;
GRANT ALL ON public.layout_sections TO service_role;

ALTER TABLE public.layout_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view layout sections"
  ON public.layout_sections FOR SELECT USING (true);

CREATE POLICY "Admins manage layout sections"
  ON public.layout_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_layout_sections_updated_at
  BEFORE UPDATE ON public.layout_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.layout_sections (key, title, kind, position, enabled) VALUES
  ('hero', 'Öne Çıkanlar (Slider)', 'hero', 0, true),
  ('series_tr', 'Popüler Diziler', 'row', 1, true),
  ('series_foreign', 'Yabancı Diziler', 'row', 2, true),
  ('movies', 'Filmler', 'row', 3, true),
  ('live_tv', 'Canlı TV', 'row', 4, true),
  ('foreign_channels', 'Yabancı Kanallar', 'row', 5, true)
ON CONFLICT (key) DO NOTHING;