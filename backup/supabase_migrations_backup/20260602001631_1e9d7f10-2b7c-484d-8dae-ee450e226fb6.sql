CREATE TABLE public.user_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Live TV', 'Series', 'Movies')),
  stream_type TEXT NOT NULL CHECK (stream_type IN ('HLS', 'MP4')),
  poster_url TEXT,
  backdrop_url TEXT,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_streams TO anon;
GRANT SELECT ON public.user_streams TO authenticated;
GRANT ALL ON public.user_streams TO service_role;

ALTER TABLE public.user_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active sources are visible to everyone"
ON public.user_streams
FOR SELECT
USING (is_active = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_streams_updated_at
BEFORE UPDATE ON public.user_streams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_streams_category ON public.user_streams(category);
CREATE INDEX idx_user_streams_active_created ON public.user_streams(is_active, created_at DESC);