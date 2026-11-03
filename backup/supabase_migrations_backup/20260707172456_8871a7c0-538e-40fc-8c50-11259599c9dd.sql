CREATE TABLE public.scraper_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text UNIQUE NOT NULL,
  hint text,
  force_category text CHECK (force_category IN ('Live TV','Series','Movies','Radio')) ,
  priority int NOT NULL DEFAULT 5,
  last_scanned_at timestamptz,
  last_error text,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scraper_seeds TO authenticated;
GRANT ALL ON public.scraper_seeds TO service_role;

ALTER TABLE public.scraper_seeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scraper_seeds"
  ON public.scraper_seeds FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage scraper_seeds"
  ON public.scraper_seeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX scraper_seeds_next_idx ON public.scraper_seeds (disabled, last_scanned_at NULLS FIRST, priority DESC);
