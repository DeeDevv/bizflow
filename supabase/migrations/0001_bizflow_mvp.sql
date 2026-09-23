-- ============================================================================
-- BizFlow MVP — Supabase schema migration 0001 (Phase 5.3)
-- Approved proposal: bizflow-tmp/docs/supabase-schema-proposal.md
--
-- Creates 7 tables: businesses, products, customers, invoices, invoice_items,
-- payments, receipts. Money = numeric(12,2). line_total is a generated column.
-- RLS is intentionally NOT enabled yet (no Auth exists — see the template at
-- the bottom). owner_user_id + business_id are the hooks the policies need.
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS.
-- ============================================================================

begin;

-- Keeps updated_at fresh on the four mutable tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. businesses — one row per business (the Settings page data)
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text,
  phone             text,
  address           text,
  whatsapp          text,
  currency          text not null default 'USD',
  logo_url          text,
  discounts_enabled boolean not null default true,
  invoice_seq       integer not null default 2040,
  owner_user_id     uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. products — the catalog (Products page)
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  price       numeric(12,2) not null default 0 check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. customers — contact info only (Customers page)
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. invoices — the document header (subtotal/total stored, discount clamped)
-- ----------------------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  customer_id    uuid not null references public.customers (id) on delete restrict,
  invoice_number text not null,
  issue_date     date not null,
  due_date       date not null,
  status         text not null default 'pending'
                 check (status in ('draft', 'pending', 'overdue', 'paid')),
  discount_type  text check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) check (discount_value >= 0),
  subtotal       numeric(12,2) not null default 0 check (subtotal >= 0),
  total          numeric(12,2) not null default 0 check (total >= 0),
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- discount_type and discount_value are set or cleared together
  constraint invoices_discount_pair check (
    (discount_type is null and discount_value is null) or
    (discount_type is not null and discount_value is not null)
  ),
  -- a percentage discount can never exceed 100% (mirrors the app's clamp)
  constraint invoices_discount_percent_max check (
    discount_type is distinct from 'percent' or discount_value <= 100
  ),
  constraint invoices_due_after_issue check (due_date >= issue_date),
  -- invoice numbers are unique within a business (INV-2041)
  constraint invoices_number_unique_per_business unique (business_id, invoice_number)
);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. invoice_items — line items; line_total is computed by the database
-- ----------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  description text not null,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. payments — money received against an invoice (partial payments later)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  paid_at     timestamptz not null default now(),
  method      text,
  note        text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. receipts — one per payment, with a frozen jsonb snapshot
-- ----------------------------------------------------------------------------
create table if not exists public.receipts (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  payment_id     uuid not null unique references public.payments (id) on delete cascade,
  receipt_number text not null,
  issued_at      timestamptz not null default now(),
  snapshot       jsonb not null check (jsonb_typeof (snapshot) = 'object'),
  created_at     timestamptz not null default now(),
  constraint receipts_number_unique_per_business unique (business_id, receipt_number)
);

-- ----------------------------------------------------------------------------
-- Indexes for the app's lookups (per-business lists, invoice drill-downs)
-- ----------------------------------------------------------------------------
create index if not exists products_business_id_idx     on public.products (business_id);
create index if not exists customers_business_id_idx    on public.customers (business_id);
create index if not exists invoices_business_id_idx     on public.invoices (business_id);
create index if not exists invoices_customer_id_idx     on public.invoices (customer_id);
create index if not exists invoices_business_status_idx on public.invoices (business_id, status);
create index if not exists invoices_paid_at_idx         on public.invoices (business_id, paid_at);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists invoice_items_product_id_idx on public.invoice_items (product_id);
create index if not exists payments_invoice_id_idx      on public.payments (invoice_id);
create index if not exists payments_business_paid_idx   on public.payments (business_id, paid_at);
create index if not exists receipts_payment_id_idx      on public.receipts (payment_id);

commit;

-- ============================================================================
-- RLS-READINESS — run this section LATER, when Supabase Auth is added.
-- (Deliberately not enabled now: there is no authentication yet, and enabling
-- RLS with zero policies would block every query. The SQL Editor runs as the
-- table owner, so it keeps working either way.)
--
-- alter table public.businesses    enable row level security;
-- alter table public.products      enable row level security;
-- alter table public.customers     enable row level security;
-- alter table public.invoices      enable row level security;
-- alter table public.invoice_items enable row level security;
-- alter table public.payments      enable row level security;
-- alter table public.receipts      enable row level security;
--
-- Example policy shape (repeat per table, matching each table's business_id):
-- create policy "own business rows" on public.customers
--   for all using (
--     business_id in (select id from public.businesses where owner_user_id = auth.uid())
--   );
-- ============================================================================
