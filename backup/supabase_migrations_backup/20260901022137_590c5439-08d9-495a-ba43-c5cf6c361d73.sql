-- 1. Extend roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_editor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tech_operator';

-- 2. Soft delete columns
ALTER TABLE public.user_streams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.user_streams ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.scraper_seeds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.scraper_seeds ADD COLUMN IF NOT EXISTS deleted_by UUID;
CREATE INDEX IF NOT EXISTS user_streams_deleted_at_idx ON public.user_streams (deleted_at);
CREATE INDEX IF NOT EXISTS scraper_seeds_deleted_at_idx ON public.scraper_seeds (deleted_at);

-- 3. Automation rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  match_field TEXT NOT NULL DEFAULT 'url',
  match_operator TEXT NOT NULL DEFAULT 'contains',
  match_value TEXT NOT NULL,
  set_category TEXT,
  set_sub_category TEXT,
  set_country TEXT,
  set_is_foreign BOOLEAN,
  set_is_active BOOLEAN,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automation rules" ON public.automation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_label TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. System metrics
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_metrics_metric_recorded_idx ON public.system_metrics (metric, recorded_at DESC);
GRANT SELECT ON public.system_metrics TO authenticated;
GRANT ALL ON public.system_metrics TO service_role;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read system metrics" ON public.system_metrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. updated_at trigger for automation_rules
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();