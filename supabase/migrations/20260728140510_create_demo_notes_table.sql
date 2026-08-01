/*
# Create demo notes table for the database browser

1. New Tables
- `notes` — a simple notes table to demonstrate the in-app database browser.
  - `id` (uuid, primary key)
  - `title` (text, not null) — note title
  - `body` (text) — note content
  - `priority` (int, default 1) — priority level 1-5
  - `done` (boolean, default false) — completion flag
  - `created_at` (timestamptz) — creation timestamp

2. Security
- Enable RLS on `notes`.
- This is a single-tenant demo app with no sign-in screen, so allow anon + authenticated
  full CRUD. The data is intentionally public/shared.

3. Seed data
- Insert 3 sample rows so the browser has content on first load.
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text DEFAULT '',
  priority int NOT NULL DEFAULT 1,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notes" ON notes;
CREATE POLICY "anon_select_notes" ON notes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notes" ON notes;
CREATE POLICY "anon_insert_notes" ON notes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notes" ON notes;
CREATE POLICY "anon_update_notes" ON notes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notes" ON notes;
CREATE POLICY "anon_delete_notes" ON notes FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO notes (title, body, priority, done)
SELECT * FROM (VALUES
  ('Welcome to OpenCode', 'This is a demo note. You can edit, add, and delete rows from the Database tab.', 3, false),
  ('Try the AI assistant', 'Ask the AI to create a component, then push changes to GitHub.', 2, true),
  ('Database browser', 'This table is stored in Supabase. Edit cells inline and save changes.', 1, false)
) AS v(title, body, priority, done)
WHERE NOT EXISTS (SELECT 1 FROM notes LIMIT 1);
