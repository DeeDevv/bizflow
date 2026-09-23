# BizFlow MVP — Proposed Supabase Schema (Phase 5.3)

Status: **PROPOSAL — nothing has been created.** Awaiting approval.
Source of truth: actual code in `bizflow-tmp/src/lib/types.ts`, the four stores,
and the forms (InvoiceForm, ProductFormModal, CustomerFormModal, Settings page).

---

## 1. What the frontend actually does today (inspection findings)

**Business information collected** (Settings page → `BusinessInfo`):
`name`, `email`, `phone`, `address`, `whatsapp`, `currency` (ISO code, 14 options),
`logoUrl` (data-URL or remote URL), `discountsEnabled` (toggles the invoice discount UI).

**Product information** (`Product`, Products page):
`name`, `price`, `stock` (int; status badge derived: In stock / Low stock ≤5 / Out ≤0),
`imageUrl`. Product names/prices currently **match invoice line items only by
convention** — the invoice form has free-text fields, no product picker yet.

**Customer information** (`Customer`, Customers page):
`name`, `email`, `phone` — that's all. Purchases/outstanding are **derived at
runtime** from invoices; nothing is stored on the customer.

**Required to create an invoice** (InvoiceForm, 3 steps):
customer, 1+ line items (`description`, `quantity` ≥1, `unitPrice` ≥0), optional
discount, `issueDate` (default today), `dueDate` (default +30 days), starting
status (`pending` or `paid`). The invoice number (`INV-2041`…) is auto-assigned
by continuing the highest existing number. Subtotal → discount → final total are
computed, clamped at $0.

**How discounts are handled** (invoice-level, never item-level):
one optional `{ type: "percent" | "fixed", value }` per invoice; dollar value =
percent×subtotal or fixed; rounded to cents; **clamped so the total never goes
negative**; only offered when `discountsEnabled` is on. Stored, not recomputed
later (the discount shown on a saved invoice is what was applied).

**What happens when a payment is made** (Mark as Paid):
sets `status = "paid"` and `paidAt = today` (ISO date). A "sale" is *derived* —
any paid invoice (`lib/sales.ts`); no separate sale record exists. Partial
payments, methods, and references have no UI yet.

**Receipts**: there is **no receipt document or entity**. The invoice details
page (business header + bill-to + items + Subtotal/Discount/Final Total) is
printed/PDF'd via the browser and doubles as the receipt.

**Dashboard figures that depend on stored data** (Overview / Sales pages):
Total Sales = Σ final totals of paid invoices; Outstanding Invoices = Σ totals
of unpaid invoices; Total Customers = count; Recent Sales = latest paid
invoices by `paidAt`; date filters operate on payment dates.

---

## 2. Proposed tables (7 — exactly the MVP set)

Conventions for all tables: `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz not null default now()`, `updated_at timestamptz not
null default now()`. Money is **numeric(12,2)** (never float). Every table
carries `business_id` so one schema later serves many businesses.

### businesses
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text not null | from Settings |
| email | text | |
| phone | text | |
| address | text | |
| whatsapp | text | |
| currency | text not null default 'USD' | ISO code for all money display |
| logo_url | text | data-URL or remote URL |
| discounts_enabled | boolean not null default true | gates the discount UI |
| invoice_seq | integer not null default 2040 | next INV-#### counter |
| owner_user_id | uuid | null for now; filled when Auth arrives |

### products
| column | type | notes |
|---|---|---|
| id, business_id | | business_id → businesses.id |
| name | text not null | |
| price | numeric(12,2) not null default 0 | selling price per unit |
| stock | integer not null default 0 | status badge derived from this |
| image_url | text | |

### customers
| column | type | notes |
|---|---|---|
| id, business_id | | business_id → businesses.id |
| name | text not null | |
| email | text | |
| phone | text | |

### invoices
| column | type | notes |
|---|---|---|
| id, business_id | | business_id → businesses.id |
| customer_id | uuid not null → customers.id | |
| invoice_number | text not null | **unique per business** (INV-2041) |
| issue_date | date not null | |
| due_date | date not null | |
| status | text not null, CHECK in ('draft','pending','overdue','paid') | 'overdue' stays computed-at-read like today |
| discount_type | text null, CHECK in ('percent','fixed') | null = no discount |
| discount_value | numeric(12,2) null | percent 0–100 or fixed amount |
| subtotal | numeric(12,2) not null | Σ(qty × unit_price), stored |
| total | numeric(12,2) not null | subtotal − discount, clamped ≥ 0, stored |
| paid_at | timestamptz null | set when payment is recorded |

### invoice_items
| column | type | notes |
|---|---|---|
| id, invoice_id | | invoice_id → invoices.id **ON DELETE CASCADE** |
| product_id | uuid null → products.id **ON DELETE SET NULL** | null today (free-text form); ready for a product picker |
| description | text not null | what the UI has today |
| quantity | integer not null, CHECK (quantity > 0) | |
| unit_price | numeric(12,2) not null, CHECK (unit_price >= 0) | |
| line_total | numeric(12,2) GENERATED | quantity × unit_price |

### payments
| column | type | notes |
|---|---|---|
| id, business_id | | business_id → businesses.id |
| invoice_id | uuid not null → invoices.id | |
| amount | numeric(12,2) not null, CHECK (amount > 0) | full amount today |
| paid_at | timestamptz not null default now() | when the money arrived |
| method | text | null for now (cash/bank later) |
| note | text | payment reference, free text |

### receipts
| column | type | notes |
|---|---|---|
| id, business_id | | business_id → businesses.id |
| payment_id | uuid not null → payments.id **UNIQUE** | one receipt per payment |
| receipt_number | text not null | unique per business (REC-0001) |
| issued_at | timestamptz not null default now() | |
| snapshot | jsonb not null | frozen copy: business info + items + totals |

---

## 3. How the tables relate

```
businesses ─┬─< products
            ├─< customers ─< invoices ─< invoice_items >? products (optional link)
            ├─< invoices
            ├─< payments >── invoices          (a payment always points at one invoice)
            └─< receipts ─── payments          (1-to-1, one receipt per payment)
```

- **customers 1—N invoices** — the bill-to link.
- **invoices 1—N invoice_items** — items die with their invoice (CASCADE).
- **invoices 1—N payments** — one "Mark as Paid" payment now; partial
  payments later need no schema change.
- **payments 1—1 receipts** — a receipt documents a payment.
- **products ?—invoice_items** — optional today; the free-text form stays valid.
- Every chain rolls up to **businesses**, so dashboards are one query per table
  filtered by `business_id`.

**UI ↔ table mapping:** Settings→businesses · Products→products · Customers→customers ·
InvoiceForm→invoices+invoice_items · Mark as Paid→payments (+ invoices.status/paid_at) ·
Invoice/Sale/Receipt documents→receipts.snapshot · Overview/Sales→derived from
invoices+payments (same formulas the UI uses today).

## 4. Design decisions

1. **Money as numeric(12,2)** — floats corrupt currency; cents stay exact.
2. **Subtotal and total stored on invoices** — historic documents must not
   change if items are edited or prices move later; dashboards read one column.
3. **Discount stored as type+value** — mirrors today's UI exactly; the clamp
   lives in one place and total can never go negative.
4. **'overdue' kept computed-at-read** — the app already derives it from
   `due_date`; storing it would go stale (same as the current code).
5. **payments as a real table** — today's "sale = paid invoice" stays true
   (sales remain derived), but payment facts (date, method, reference) finally
   have a home, enabling receipts.
6. **receipts.snapshot (jsonb)** — a receipt must never change if the business
   later renames itself or edits an invoice.
7. **invoice_seq on businesses** — replaces the highest-number+1 guess with a
   race-free counter.
8. **owner_user_id null now** — when Supabase Auth lands, every table's RLS
   policy simply adds `business_id in (select id from businesses where
   owner_user_id = auth.uid())`. Multi-owner isolation without a migration.

## 5. Intentionally excluded (per your constraints)

No employees/roles tables · no WhatsApp fields beyond the existing number ·
no payment-gateway tables · no tax fields (the UI has none) · no multi-currency
per invoice (one currency per business, as today) · no audit logs. Tables are
NOT created yet — approval required.
