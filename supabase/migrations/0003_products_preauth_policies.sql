-- ============================================================================
-- BizFlow migration 0003 — temporary pre-auth policies for `products`
-- (Phase 5.5: RLS is enabled on the table but has no policies, so the app's
--  publishable key (anon role) can read but not add/edit/delete products.)
--
-- Authentication is NOT implemented yet. These four policies let the anon
-- role use products so the catalog works. WHEN SUPABASE AUTH IS ADDED:
-- delete these and use owner-scoped policies (template at the bottom of
-- 0001_bizflow_mvp.sql). Safe to re-run.
-- ============================================================================

alter table public.products enable row level security;

drop policy if exists "bizflow_anon_select_products" on public.products;
drop policy if exists "bizflow_anon_insert_products" on public.products;
drop policy if exists "bizflow_anon_update_products" on public.products;
drop policy if exists "bizflow_anon_delete_products" on public.products;

create policy "bizflow_anon_select_products"
  on public.products for select to anon
  using (true);

create policy "bizflow_anon_insert_products"
  on public.products for insert to anon
  with check (true);

create policy "bizflow_anon_update_products"
  on public.products for update to anon
  using (true) with check (true);

create policy "bizflow_anon_delete_products"
  on public.products for delete to anon
  using (true);
