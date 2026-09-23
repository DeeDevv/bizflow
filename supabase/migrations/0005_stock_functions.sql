-- Migration 0005 — Stock deduction foundation (Phase 5.7 preparation)
--
-- Creates two small, race-safe database functions the app will call when
-- invoices are completed in Phase 5.7. Nothing in the UI changes and nothing
-- calls these yet — this is the foundation only.
--
-- Why a function instead of "read stock, then update it" from the app:
-- two invoices completing at the same moment could both read 12 units and
-- both deduct 3, leaving 9 instead of 6. Inside the database the
-- check-and-deduct happens as ONE atomic operation, so this cannot happen.
--
-- Stock stays an integer and can never go below 0:
--   - the products.stock column is `integer ... check (stock >= 0)` (0001)
--   - deduction refuses to run when there is not enough stock
--
-- SECURITY INVOKER on purpose: the function runs with the caller's role,
-- so the existing RLS policies on `products` still decide who may touch
-- which rows (anon policies from 0003 today; owner-scoped after Auth).
--
-- Idempotent: safe to run more than once.

-- Deduct stock for one product. Returns the new stock level.
-- Raises an error when the quantity is invalid or there is not enough
-- stock, so a sale can never silently oversell.
create or replace function public.deduct_product_stock(
  p_product_id uuid,
  p_quantity integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity to deduct must be a positive whole number.';
  end if;

  update public.products
     set stock = stock - p_quantity
   where id = p_product_id
     and stock >= p_quantity
  returning stock into v_new_stock;

  if v_new_stock is null then
    raise exception 'Not enough stock to complete this sale.';
  end if;

  return v_new_stock;
end;
$$;

-- Add stock back for one product (Phase 5.7 will use this when an invoice
-- is edited or reversed, so quantities return to inventory).
create or replace function public.restore_product_stock(
  p_product_id uuid,
  p_quantity integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity to restore must be a positive whole number.';
  end if;

  update public.products
     set stock = stock + p_quantity
   where id = p_product_id
  returning stock into v_new_stock;

  if v_new_stock is null then
    raise exception 'Product not found.';
  end if;

  return v_new_stock;
end;
$$;

-- The app calls these through Supabase RPC with the publishable key.
grant execute on function public.deduct_product_stock(uuid, integer) to anon, authenticated;
grant execute on function public.restore_product_stock(uuid, integer) to anon, authenticated;
