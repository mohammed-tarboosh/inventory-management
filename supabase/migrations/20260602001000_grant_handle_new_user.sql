-- Grant execute on handle_new_user to allow auth insert triggers to run
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;