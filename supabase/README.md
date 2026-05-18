# Supabase setup

1. Create a Supabase project with Postgres 15 or newer.
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. Run `supabase/migrations/20260518123000_initial_devwiki.sql` in the Supabase SQL editor.
4. Insert the five study member emails into `public.study_members`.
5. Enable email magic links in Supabase Auth settings and add the deployed app URL to allowed redirect URLs.

The schema keeps all public tables behind RLS. New Supabase projects may not expose SQL-created tables to the Data API automatically, so this migration grants the `authenticated` role access explicitly and lets RLS decide which rows are visible.
