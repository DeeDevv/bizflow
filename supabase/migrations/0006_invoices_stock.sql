-- Migration 0006 — Invoices ↔ Supabase + safe stock deduction (Phase 5.7)
--
-- 1. TEMPORARY pre-auth RLS policies for `invoices` and `invoice_items`
--    (same clearly-marked pattern as 0002/0003/0004 — replaced with
--    owner-scoped policies when Supabase Auth arrives).
-- 2. A `stock_deducted_at` guard column on invoices so a finalized sale can
--    never deduct stock twice (refresh / reopen / save again are all no-ops).
-- 3. `finalize_invoice_sale(p_invoice_id)` — completes an invoice as paid
--    AND deducts product stock in ONE atomic database transaction:
--      · the invoice row is locked for the whole operation
--      · every product-linked item goes through deduct_product_stock
--        (migration 0005), which refuses when stock is insufficient
--      · any failure rolls the ENTIRE transaction back — the invoice stays
--        unpaid and no stock moves; stock can never go negative
--
-- Idempotent: safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. RLS: enable + temporary anon policies (pre-auth only)
-- ----------------------------------------------------------------------------
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "bizflow_anon_select_invoices"  on public.invoices;
drop policy if exists "bizflow_anon_insert_invoices"  on public.invoices;
drop policy if exists "bizflow_anon_update_invoices"  on public.invoices;
drop policy if exists "bizflow_anon_delete_invoices"  on public.invoices;

create policy "bizflow_anon_select_invoices"
  on public.invoices for select to anon using (true);
create policy "bizflow_anon_insert_invoices"
  on public.invoices for insert to anon with check (true);
create policy "bizflow_anon_update_invoices"
  on public.invoices for update to anon using (true) with check (true);
create policy "bizflow_anon_delete_invoices"
  on public.invoices for delete to anon using (true);

-- invoice_items has no business_id; visibility follows the parent invoice.
drop policy if exists "bizflow_anon_all_invoice_items" on public.invoice_items;
create policy "bizflow_anon_all_invoice_items"
  on public.invoice_items for all to anon
  using (
    exists (
      select 1 from public.invoices inv
      where inv.id = invoice_items.invoice_id
    )
  )
  with check (
    exists (
      select 1 from public.invoices inv
      where inv.id = invoice_items.invoice_id
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Double-deduction guard column
-- ----------------------------------------------------------------------------
alter table public.invoices
  add column if not exists stock_deducted_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3. Atomic finalize: mark paid + deduct stock in one transaction
-- ----------------------------------------------------------------------------
create or replace function public.finalize_invoice_sale(
  p_invoice_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status      text;
  v_deducted_at timestamptz;
  v_paid_at     timestamptz;
  item record; -- loop variable for the item rows
begin
  -- Lock the invoice row: two simultaneous finals queue here instead of
  -- both deducting.
  select business_id, status, stock_deducted_at, paid_at
    into v_business_id, v_status, v_deducted_at, v_paid_at
  from public.invoices
  where id = p_invoice_id
  for update;

  if v_business_id is null then
    raise exception 'Invoice not found.';
  end if;

  -- Already finalized as a sale: nothing to do (refresh/reopen/save again).
  if v_status = 'paid' and v_deducted_at is not null then
    return;
  end if;

  -- Deduct stock for every product-linked line item. Each call runs
  -- deduct_product_stock (0005): atomic per product, refuses to oversell,
  -- and any failure aborts this whole transaction.
  for item in
    select product_id, quantity
    from public.invoice_items
    where invoice_id = p_invoice_id
      and product_id is not null
  loop
    perform public.deduct_product_stock(item.product_id, item.quantity);
  end loop;

  -- Mark paid. Keep an existing paid_at (re-finalizing an old paid invoice
  -- without a deduction stamp) rather than moving the sale date.
  update public.invoices
     set status = 'paid',
         paid_at = coalesce(v_paid_at, now()),
         stock_deducted_at = now()
   where id = p_invoice_id;
end;
$$;

grant execute on function public.finalize_invoice_sale(uuid) to anon, authenticated;
