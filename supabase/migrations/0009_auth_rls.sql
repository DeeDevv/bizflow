-- ============================================================================
-- BizFlow — migration 0009: Authentication & Security (Phase 6)
--
-- Replaces every temporary pre-auth `anon` policy (0002–0008) with proper
-- owner-scoped policies driven by businesses.owner_user_id = auth.uid().
--
-- Security chain: authenticated user → owns business → owns every row that
-- references it (products, customers, invoices, payments, receipts) and every
-- invoice_item through its parent invoice. Anonymous (signed-out) access to
-- business data is fully removed.
--
-- Safe to re-run: every statement is IF EXISTS / OR REPLACE / drop-first.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Remove the temporary pre-auth policies (25 of them, 0002–0008)
-- ----------------------------------------------------------------------------
drop policy if exists "bizflow_anon_select_businesses" on public.businesses;
drop policy if exists "bizflow_anon_insert_businesses" on public.businesses;
drop policy if exists "bizflow_anon_update_businesses" on public.businesses;

drop policy if exists "bizflow_anon_select_products" on public.products;
drop policy if exists "bizflow_anon_insert_products" on public.products;
drop policy if exists "bizflow_anon_update_products" on public.products;
drop policy if exists "bizflow_anon_delete_products" on public.products;

drop policy if exists "bizflow_anon_select_customers" on public.customers;
drop policy if exists "bizflow_anon_insert_customers" on public.customers;
drop policy if exists "bizflow_anon_update_customers" on public.customers;
drop policy if exists "bizflow_anon_delete_customers" on public.customers;

drop policy if exists "bizflow_anon_select_invoices" on public.invoices;
drop policy if exists "bizflow_anon_insert_invoices" on public.invoices;
drop policy if exists "bizflow_anon_update_invoices" on public.invoices;
drop policy if exists "bizflow_anon_delete_invoices" on public.invoices;
drop policy if exists "bizflow_anon_all_invoice_items" on public.invoice_items;

drop policy if exists "bizflow_anon_select_payments" on public.payments;
drop policy if exists "bizflow_anon_insert_payments" on public.payments;
drop policy if exists "bizflow_anon_update_payments" on public.payments;
drop policy if exists "bizflow_anon_delete_payments" on public.payments;

drop policy if exists "bizflow_anon_select_receipts" on public.receipts;
drop policy if exists "bizflow_anon_insert_receipts" on public.receipts;
drop policy if exists "bizflow_anon_update_receipts" on public.receipts;
drop policy if exists "bizflow_anon_delete_receipts" on public.receipts;

-- ----------------------------------------------------------------------------
-- 2. businesses — exactly one owner per row; the owner is the tenant boundary
-- ----------------------------------------------------------------------------
create policy "bizflow_owner_select_business"
  on public.businesses for select to authenticated
  using (owner_user_id = auth.uid());

create policy "bizflow_owner_insert_business"
  on public.businesses for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "bizflow_owner_update_business"
  on public.businesses for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "bizflow_owner_delete_business"
  on public.businesses for delete to authenticated
  using (owner_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Direct children (business_id column): products, customers, invoices,
--    payments, receipts — every statement checked against the owner's business
-- ----------------------------------------------------------------------------

create policy "bizflow_owner_all_products"
  on public.products for all to authenticated
  using (business_id in (select id from public.businesses where owner_user_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_user_id = auth.uid()));

create policy "bizflow_owner_all_customers"
  on public.customers for all to authenticated
  using (business_id in (select id from public.businesses where owner_user_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_user_id = auth.uid()));

create policy "bizflow_owner_all_invoices"
  on public.invoices for all to authenticated
  using (business_id in (select id from public.businesses where owner_user_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_user_id = auth.uid()));

create policy "bizflow_owner_all_payments"
  on public.payments for all to authenticated
  using (business_id in (select id from public.businesses where owner_user_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_user_id = auth.uid()));

create policy "bizflow_owner_all_receipts"
  on public.receipts for all to authenticated
  using (business_id in (select id from public.businesses where owner_user_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. invoice_items — no business_id column; isolation flows through the
--    parent invoice's business
-- ----------------------------------------------------------------------------
create policy "bizflow_owner_all_invoice_items"
  on public.invoice_items for all to authenticated
  using (
    invoice_id in (
      select id from public.invoices
      where business_id in (select id from public.businesses where owner_user_id = auth.uid())
    )
  )
  with check (
    invoice_id in (
      select id from public.invoices
      where business_id in (select id from public.businesses where owner_user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Legacy-business adoption — SECURITY DEFINER on purpose
--
-- The one development business created before authentication has
-- owner_user_id = null, so its owner cannot see it through RLS yet (an
-- invoker-rights UPDATE cannot match an invisible row). This small definer
-- function lets the first authenticated user without a business claim that
-- single unowned row — and refuses when another user already owns one.
-- It can never move ownership between two owned businesses.
-- ----------------------------------------------------------------------------
create or replace function public.claim_legacy_business()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;  -- Already own a business: return it, change nothing.
  select id into v_id
    from public.businesses
   where owner_user_id = auth.uid()
   order by created_at asc
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- No business yet: adopt the single legacy (unowned) row, if any.
  -- One row at a time (oldest first) so multiple legacy rows can never
  -- break the claim, and two users can never adopt the same row.
  select id into v_id
    from public.businesses
   where owner_user_id is null
     and not exists (
       select 1 from public.businesses where owner_user_id is not null
     )
   order by created_at asc
   limit 1;

  if v_id is null then
    return null; -- no legacy business: the user creates their own
  end if;

  update public.businesses
     set owner_user_id = auth.uid()
   where id = v_id
     and owner_user_id is null
   returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.claim_legacy_business() from public;
grant execute on function public.claim_legacy_business() to authenticated;

commit;

-- ============================================================================
-- WHAT CHANGED FOR ANONYMOUS USERS: everything. With no session, zero rows of
-- business data are readable or writable through the API. All atomic RPCs
-- (finalize_invoice_sale, record_invoice_payment, create_receipt_for_payment,
-- deduct/restore_product_stock) are SECURITY INVOKER, so they run under the
-- caller's policies — a foreign invoice id now resolves as "not found".
-- ============================================================================
