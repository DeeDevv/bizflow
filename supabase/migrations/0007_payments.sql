-- Migration 0007 — Payments (Phase 5.8)
--
-- 1. TEMPORARY pre-auth RLS policies for `payments` (same clearly-marked
--    pattern as 0002–0006; replaced with owner-scoped policies when Auth
--    arrives).
-- 2. `record_invoice_payment(p_invoice_id, p_amount, p_note, p_method)` —
--    records a payment and updates the invoice's payment status in ONE
--    atomic database transaction:
--      · the invoice row is locked (simultaneous payments queue, can't both
--        squeeze past the remaining-balance check)
--      · refuses amount <= 0 and amounts that would overpay the invoice
--      · inserts the payment row (business_id, invoice_id, amount, note,
--        method, paid_at — everything Phase 5.9 receipts will need)
--      · sums the real payments: total paid >= invoice total → marks the
--        invoice paid (through finalize_invoice_sale, so the Phase 5.7
--        stock deduction runs exactly once via its guard); otherwise the
--        invoice stays pending
--
-- Repeated submissions are naturally safe: each accepted payment is a real
-- row, and the balance check can never be passed twice by the same money.
--
-- Idempotent: safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. RLS: enable + temporary anon policy (pre-auth only)
-- ----------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "bizflow_anon_select_payments"  on public.payments;
drop policy if exists "bizflow_anon_insert_payments"  on public.payments;
drop policy if exists "bizflow_anon_update_payments"  on public.payments;
drop policy if exists "bizflow_anon_delete_payments"  on public.payments;

create policy "bizflow_anon_select_payments"
  on public.payments for select to anon using (true);
create policy "bizflow_anon_insert_payments"
  on public.payments for insert to anon with check (true);
create policy "bizflow_anon_update_payments"
  on public.payments for update to anon using (true) with check (true);
create policy "bizflow_anon_delete_payments"
  on public.payments for delete to anon using (true);

-- ----------------------------------------------------------------------------
-- 2. Atomic payment recording
-- ----------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount     numeric,
  p_note       text default null,
  p_method     text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid;
  v_total       numeric(12,2);
  v_already     numeric(12,2);
  v_status      text;
  v_payment_id  uuid;
  v_paid_at     timestamptz;
  v_now_paid    boolean;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  -- Lock the invoice row: concurrent payments queue here instead of both
  -- slipping past the balance check.
  select business_id, total, status
    into v_business_id, v_total, v_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if v_business_id is null then
    raise exception 'Invoice not found.';
  end if;

  -- Amount already recorded for this invoice, from real payment rows.
  select coalesce(sum(amount), 0)
    into v_already
  from public.payments
  where invoice_id = p_invoice_id;

  if p_amount > v_total - v_already then
    raise exception 'Payment exceeds the remaining balance. Remaining: %',
      to_char(v_total - v_already, 'FM9999999999990.00');
  end if;

  -- Record the payment.
  insert into public.payments (business_id, invoice_id, amount, note, method)
  values (v_business_id, p_invoice_id, round(p_amount, 2), p_note, p_method)
  returning id, paid_at into v_payment_id, v_paid_at;

  v_now_paid := (v_already + round(p_amount, 2)) >= v_total;

  if v_now_paid and v_status <> 'paid' then
    -- Single stock-deduction path: finalize_invoice_sale is a no-op if the
    -- invoice was already finalized (stock_deducted_at guard from 0006).
    perform public.finalize_invoice_sale(p_invoice_id);
  elsif v_now_paid then
    -- Paid invoices that were never stock-deducted (e.g. created directly
    -- as paid) get their one-time deduction here too.
    perform public.finalize_invoice_sale(p_invoice_id);
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'paid_at', v_paid_at,
    'total_paid', v_already + round(p_amount, 2),
    'invoice_total', v_total,
    'invoice_paid', v_now_paid
  );
end;
$$;

grant execute on function public.record_invoice_payment(uuid, numeric, text, text)
  to anon, authenticated;
