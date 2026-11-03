REVOKE EXECUTE ON FUNCTION public.get_system_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_status() TO service_role;