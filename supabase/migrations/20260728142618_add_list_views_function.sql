/*
# Add list_user_views() introspection function

1. New Functions
- `list_user_views()` — returns names of all views in the `public` schema.
  Security definer so the anon role can introspect the view catalog.

2. Security
- SECURITY DEFINER, read-only (SELECT on pg_catalog).
- GRANT EXECUTE to anon + authenticated.
*/

CREATE OR REPLACE FUNCTION list_user_views()
RETURNS TABLE (view_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewname::text
  FROM pg_views
  WHERE schemaname = 'public'
  ORDER BY viewname;
$$;

GRANT EXECUTE ON FUNCTION list_user_views() TO anon, authenticated;
