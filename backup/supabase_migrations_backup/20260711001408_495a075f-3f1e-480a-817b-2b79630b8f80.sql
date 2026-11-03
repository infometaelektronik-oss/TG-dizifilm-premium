REVOKE EXECUTE ON FUNCTION public.get_system_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_system_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_system_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;