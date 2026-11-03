ALTER TABLE public.user_streams
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_foreign boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_streams_country_idx ON public.user_streams (country);
CREATE INDEX IF NOT EXISTS user_streams_category_active_idx ON public.user_streams (category, is_active);