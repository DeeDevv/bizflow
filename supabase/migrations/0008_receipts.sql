-- Migration 0008 — Receipts (Phase 5.9)
--
-- 1. TEMPORARY pre-auth RLS policies for `receipts` (same clearly-marked
--    pattern as 0002–0007; replaced with owner-scoped policies when Auth
--    arrives).
-- 2. `create_receipt_for_payment(p_payment_id)` — creates a receipt for a
--    payment in ONE atomic transaction:
--      · locks the payment row (simultaneous requests queue)
--      · refuses when the payment (or its invoice) does not exist
--      · REFUSES when a receipt already exists for the payment — one
--        payment can never have two receipts
--      · freezes a full JSONB snapshot (business, customer, invoice, items,
--        payment, currency, balances) so the receipt stays accurate even if
--        the business name, phone, address, customer info, product names,
--        product prices, or the business currency change later
--      · generates the next RCP-#### number from the business's existing
--        receipts (max + 1), unique per business by constraint
--
-- Idempotent: safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. RLS: enable + temporary anon policies (pre-auth only)
-- ----------------------------------------------------------------------------
alter table public.receipts enable row level security;

drop policy if exists "bizflow_anon_select_receipts"  on public.receipts;
drop policy if exists "bizflow_anon_insert_receipts"  on public.receipts;
drop policy if exists "bizflow_anon_update_receipts"  on public.receipts;
drop policy if exists "bizflow_anon_delete_receipts"  on public.receipts;

create policy "bizflow_anon_select_receipts"
  on public.receipts for select to anon using (true);
create policy "bizflow_anon_insert_receipts"
  on public.receipts for insert to anon with check (true);
create policy "bizflow_anon_update_receipts"
  on public.receipts for update to anon using (true) with check (true);
create policy "bizflow_anon_delete_receipts"
  on public.receipts for delete to anon using (true);

-- ----------------------------------------------------------------------------
-- 2. Atomic receipt creation with snapshot freeze
-- ----------------------------------------------------------------------------
create or replace function public.create_receipt_for_payment(
  p_payment_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt_id     uuid;
  v_business_id    uuid;
  v_existing       uuid;
  v_receipt_number text;
  v_snapshot       jsonb;
begin
  -- Lock the payment row: two simultaneous requests queue here instead of
  -- both creating a receipt.
  select business_id into v_business_id
  from public.payments
  where id = p_payment_id
  for update;

  if v_business_id is null then
    raise exception 'Payment not found.';
  end if;

  -- One receipt per payment, ever.
  select id into v_existing
  from public.receipts
  where payment_id = p_payment_id;
  if v_existing is not null then
    return v_existing; -- idempotent: return the existing receipt instead of duplicating
  end if;

  -- Snapshot: everything Phase 5.9 needs, frozen at creation time.
  select jsonb_build_object(
    'receiptNumber', null, -- filled below after numbering
    'issuedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'currency', b.currency,
    'business', jsonb_build_object(
      'name', b.name,
      'email', b.email,
      'phone', b.phone,
      'whatsapp', b.whatsapp,
      'address', b.address,
      'logoUrl', b.logo_url
    ),
    'customer', jsonb_build_object(
      'name', c.name,
      'email', c.email,
      'phone', c.phone
    ),
    'invoice', jsonb_build_object(
      'id', inv.id,
      'number', inv.invoice_number,
      'issueDate', inv.issue_date,
      'dueDate', inv.due_date,
      'status', inv.status
    ),
    'items', coalesce(i.items, '[]'::jsonb),
    'subtotal', inv.subtotal,
    'discount', case
      when inv.discount_type is null then null
      else jsonb_build_object(
        'type', inv.discount_type,
        'value', inv.discount_value,
        -- Mirrors the app's discountAmount(): rounded to cents, never
        -- more than the subtotal.
        'amount', case
          when inv.discount_type = 'percent'
            then least(round(inv.subtotal * least(inv.discount_value, 100) / 100.0, 2), inv.subtotal)
          else least(round(inv.discount_value, 2), inv.subtotal)
        end
      )
    end,
    'total', inv.total,
    'payment', jsonb_build_object(
      'id', pay.id,
      'amount', pay.amount,
      'method', pay.method,
      'note', pay.note,
      'paidAt', pay.paid_at
    ),
    'amountPaid', pay.amount,
    'totalPaidToDate', (
      select coalesce(sum(amount), 0) from public.payments
      where invoice_id = inv.id and paid_at <= pay.paid_at
    ),
    'remainingBalance', greatest(
      inv.total - (
        select coalesce(sum(amount), 0) from public.payments
        where invoice_id = inv.id and paid_at <= pay.paid_at
      ), 0)
  )
  into v_snapshot
  from public.payments pay
  join public.invoices inv on inv.id = pay.invoice_id
  join public.businesses b on b.id = pay.business_id
  join public.customers c on c.id = inv.customer_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'description', it.description,
        'quantity', it.quantity,
        'unitPrice', it.unit_price,
        'lineTotal', it.line_total
      ) order by it.created_at
    ) as items
    from public.invoice_items it
    where it.invoice_id = inv.id
  ) i on true
  where pay.id = p_payment_id;

  if v_snapshot is null then
    raise exception 'Payment not found.';
  end if;

  -- Receipt number: max RCP-#### for this business, + 1 (0001 start).
  select 'RCP-' || lpad((coalesce(max(nullif(regexp_replace(receipt_number, '^RCP-', ''), '')::numeric), 0) + 1)::int::text, 4, '0')
    into v_receipt_number
  from public.receipts
  where business_id = v_business_id
    and receipt_number ~ '^RCP-\d+$';

  insert into public.receipts (business_id, payment_id, receipt_number, snapshot)
  values (v_business_id, p_payment_id, v_receipt_number, v_snapshot)
  returning id into v_receipt_id;

  -- Stamp the number into the frozen snapshot too.
  update public.receipts
     set snapshot = jsonb_set(snapshot, '{receiptNumber}', to_jsonb(v_receipt_number))
   where id = v_receipt_id;

  return v_receipt_id;
end;
$$;

grant execute on function public.create_receipt_for_payment(uuid) to anon, authenticated;
