-- ALPHA WITNESS public-case schema. Run in Supabase SQL Editor before enabling STORAGE_BACKEND=supabase.
create table if not exists public.cases (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  input jsonb not null,
  classification text not null check (classification in ('VIDEO','NEWS_POST','PAPER','TRADER_PERSONA','ASSET','UNKNOWN')),
  status text not null,
  title text not null,
  shareable boolean not null default true,
  archived boolean not null default false,
  evidence_ledger jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  verdict jsonb not null,
  notebook jsonb not null default '{}'::jsonb,
  error text
);
-- Make the revised adapter compatible with an installation of the earlier schema as well.
alter table public.cases add column if not exists error text;
-- Remove the former in-row private-notes field. This public MVP has no owner auth, so notes are disabled.
alter table public.cases drop column if exists private_notes;
alter table public.cases enable row level security;
drop policy if exists "guest can read shareable cases" on public.cases;
drop policy if exists "owner can read own cases" on public.cases;
create policy "guest can read shareable cases" on public.cases for select to anon using (shareable = true and archived = false);
-- There are intentionally no anon/authenticated write policies. Server-side REST writes use the service-role key,
-- which bypasses RLS and must never be exposed as a NEXT_PUBLIC_ variable.
-- No private-notes table is created: owner authentication has not been implemented.
