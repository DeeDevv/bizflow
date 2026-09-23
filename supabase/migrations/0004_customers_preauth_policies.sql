-- Migration 0004 — TEMPORARY pre-auth policies for `customers`
--
-- The BizFlow app runs on the publishable key (anon role) until Supabase
-- Authentication is implemented in a later phase. Without policies the
-- RLS-enabled `customers` table rejects every read/write from the app.
--
-- ⚠ PRE-AUTH ONLY: these policies allow ANY anonymous visitor to read and
-- modify customer rows. Replace them with owner-scoped policies
-- (`business_id in (select id from businesses where owner_user_id = auth.uid())`)
-- in the Auth phase. Kept deliberately minimal: this table only.
--
-- Idempotent: safe to run more than once.

alter table public.customers enable row level security;

drop policy if exists "bizflow_anon_select_customers" on public.customers;
drop policy if exists "bizflow_anon_insert_customers" on public.customers;
drop policy if exists "bizflow_anon_update_customers" on public.customers;
drop policy if exists "bizflow_anon_delete_customers" on public.customers;

create policy "bizflow_anon_select_customers"
  on public.customers for select to anon
  using (true);

create policy "bizflow_anon_insert_customers"
  on public.customers for insert to anon
  with check (true);

create policy "bizflow_anon_update_customers"
  on public.customers for update to anon
  using (true) with check (true);

create policy "bizflow_anon_delete_customers"
  on public.customers for delete to anon
  using (true);
