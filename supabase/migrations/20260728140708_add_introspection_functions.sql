/*
# Add introspection helper functions for the database browser

1. New Functions
- `list_user_tables()` — returns names of all tables in the `public` schema. Security definer so the anon role can read the catalog.
- `get_table_columns(t_name text)` — returns column metadata (name, format, is_primary_key, is_nullable, default_value) for a given table in the `public` schema.

2. Security
- Both functions are SECURITY DEFINER so the anon-key client can introspect the schema without elevated direct grants.
- They are read-only (SELECT on pg_catalog / information_schema) — no write access is granted.
- Return types are plain tables, safe to expose.
*/

CREATE OR REPLACE FUNCTION list_user_tables()
RETURNS TABLE (table_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tablename::text
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;

CREATE OR REPLACE FUNCTION get_table_columns(t_name text)
RETURNS TABLE (
  name text,
  format text,
  is_primary_key boolean,
  is_nullable boolean,
  default_value text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.attname::text AS name,
    format_type(a.atttypid, a.atttypmod)::text AS format,
    COALESCE(pk.contype = 'p', false) AS is_primary_key,
    a.attnotnull = false AS is_nullable,
    pg_get_expr(ad.adbin, ad.adrelid)::text AS default_value
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_constraint pk ON pk.conrelid = c.oid AND pk.contype = 'p' AND a.attnum = ANY(pk.conkey)
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  WHERE c.relname = t_name
    AND n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum;
$$;

GRANT EXECUTE ON FUNCTION list_user_tables() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon, authenticated;
