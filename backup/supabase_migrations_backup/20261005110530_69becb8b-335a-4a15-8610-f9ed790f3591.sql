-- Admin-controlled home page rows
CREATE TABLE public.home_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'row',          -- 'row' | 'hero'
  mode text NOT NULL DEFAULT 'rule',         -- 'manual' | 'rule'
  display text NOT NULL DEFAULT 'poster',    -- 'poster' | 'channel'
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_items integer NOT NULL DEFAULT 30,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_rows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_rows TO authenticated;
GRANT ALL ON public.home_rows TO service_role;
ALTER TABLE public.home_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view home rows" ON public.home_rows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage home rows" ON public.home_rows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_home_rows_updated_at BEFORE UPDATE ON public.home_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.home_row_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.home_rows(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.user_streams(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (row_id, stream_id)
);
CREATE INDEX home_row_items_row_idx ON public.home_row_items(row_id, position);
GRANT SELECT ON public.home_row_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_row_items TO authenticated;
GRANT ALL ON public.home_row_items TO service_role;
ALTER TABLE public.home_row_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view home row items" ON public.home_row_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage home row items" ON public.home_row_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- App-wide switches (scraper on/off, auto publish)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES
  ('scraper_enabled', 'true'::jsonb),
  ('auto_publish', 'false'::jsonb);

-- Manual lock: automation never overrides admin edits
ALTER TABLE public.user_streams ADD COLUMN IF NOT EXISTS manual_lock boolean NOT NULL DEFAULT false;

-- Starter rows (admin can edit / delete them freely)
INSERT INTO public.home_rows (title, kind, mode, display, rule, max_items, position) VALUES
  ('Öne Çıkanlar', 'hero', 'rule', 'poster', '{"category":"Live TV","country":"Türkiye","sub_category":"Ulusal"}', 8, 0),
  ('Ulusal Kanallar', 'row', 'rule', 'channel', '{"category":"Live TV","country":"Türkiye","sub_category":"Ulusal"}', 40, 1),
  ('Popüler Diziler', 'row', 'rule', 'poster', '{"category":"Series","is_foreign":false}', 40, 2),
  ('Filmler', 'row', 'rule', 'poster', '{"category":"Movies"}', 40, 3),
  ('Yabancı Diziler', 'row', 'rule', 'poster', '{"category":"Series","is_foreign":true}', 40, 4),
  ('Haber Kanalları', 'row', 'rule', 'channel', '{"category":"Live TV","country":"Türkiye","sub_category":"Haber"}', 40, 5),
  ('Spor Kanalları', 'row', 'rule', 'channel', '{"category":"Live TV","country":"Türkiye","sub_category":"Spor"}', 40, 6),
  ('Çocuk Kanalları', 'row', 'rule', 'channel', '{"category":"Live TV","country":"Türkiye","sub_category":"Çocuk"}', 40, 7);