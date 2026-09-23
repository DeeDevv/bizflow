-- ============================================================================
-- BizFlow migration 0002 — temporary pre-auth policies for `businesses`
-- (Phase 5.4 fix: RLS is enabled on the table but had no policies, so the
--  app's publishable key (anon role) could read but not save.)
--
-- Authentication is NOT implemented yet. These policies allow the anon role
-- to use the single businesses row so the Business Setup form can save.
-- WHEN SUPABASE AUTH IS ADDED: delete these three policies and use the
-- owner-scoped template at the bottom of 0001_bizflow_mvp.sql instead.
-- Safe to re-run.
-- ============================================================================

alter table public.businesses enable row level security;

drop policy if exists "bizflow_anon_select_businesses" on public.businesses;
drop policy if exists "bizflow_anon_insert_businesses" on public.businesses;
drop policy if exists "bizflow_anon_update_businesses" on public.businesses;

create policy "bizflow_anon_select_businesses"
  on public.businesses for select to anon
  using (true);

create policy "bizflow_anon_insert_businesses"
  on public.businesses for insert to anon
  with check (true);

create policy "bizflow_anon_update_businesses"
  on public.businesses for update to anon
  using (true) with check (true);
