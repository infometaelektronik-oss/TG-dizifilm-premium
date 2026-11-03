CREATE OR REPLACE FUNCTION public.stream_facets()
RETURNS TABLE(kind text, value text, n bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT 'country', coalesce(country, ''), count(*) FROM public.user_streams WHERE deleted_at IS NULL GROUP BY 2
  UNION ALL
  SELECT 'sub_category', coalesce(sub_category, ''), count(*) FROM public.user_streams WHERE deleted_at IS NULL GROUP BY 2
$$;
REVOKE ALL ON FUNCTION public.stream_facets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stream_facets() TO service_role;