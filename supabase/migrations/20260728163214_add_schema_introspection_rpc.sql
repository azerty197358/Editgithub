/*
# Add schema introspection RPC function

1. New Functions
- `get_schema_introspection()` — Returns a table with columns: table_name, column_name, data_type, is_nullable
  Runs the exact SQL: SELECT t.table_name, c.column_name, c.data_type, c.is_nullable
  FROM information_schema.tables t JOIN information_schema.columns c
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name, c.ordinal_position

2. Security
- Function is SECURITY DEFINER so the anon role can read schema metadata via RPC.
- Granted EXECUTE to anon and authenticated roles.
- No RLS needed (function, not table).
*/

CREATE OR REPLACE FUNCTION get_schema_introspection()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.table_name::text AS table_name,
    c.column_name::text AS column_name,
    c.data_type::text AS data_type,
    c.is_nullable::text AS is_nullable
  FROM information_schema.tables t
  JOIN information_schema.columns c
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name, c.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION get_schema_introspection() TO anon, authenticated;