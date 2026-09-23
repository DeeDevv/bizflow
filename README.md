# BizFlow — Business Management SaaS Dashboard

A modern, frontend-only business management dashboard built with **Next.js (App Router)**,
**TypeScript**, and **Tailwind CSS v4**.

Design principle: **simple enough that a first-time user can understand what to do
without being trained.** No backend, auth, or payments yet.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /dashboard
```

> Note: if Turbopack is unavailable on your platform, use `npm run dev -- --webpack`.

## What's inside

**Six sections** — Overview, Products, Customers, Invoices, Sales, Settings — so the
sidebar stays clean and obvious.

- **Overview** — three plain-language stat cards (Total Sales, Outstanding Invoices,
  Total Customers) and Recent Sales. No charts, nothing else.
- **Business Settings** — the "enter it once, reuse it everywhere" hub: business
  name, email, phone, WhatsApp number, address, currency (14 options), and logo
  upload. Everything saved here flows automatically onto invoice and sale
  documents. Includes an "Enable discounts" switch that shows or hides the
  discount workflow on the invoice form.
- **Customers** — searchable list (name / email / phone) with Add Customer. Each
  customer shows name, phone, email, total purchases, and outstanding balance.
- **Customer details** — contact info, invoices with statuses, purchase history,
  and what they currently owe. Edit and Delete (with confirmation) included.
- **Products** — a searchable catalog of what you sell: name, selling price, stock
  quantity (with In stock / Low stock / Out of stock status), and an optional
  image (upload or initials tile). Add / Edit / Delete included. Product names
  and prices will be reused automatically when invoices are created in a later
  phase.
- **Invoices** — searchable, filterable list (All / Unpaid / Paid) with a clear
  Create Invoice button.
- **Create / Edit Invoice** — a three-step form: pick the customer (or add a new
  one), add line items with quantity × unit price, an optional discount
  (percentage or fixed amount), and an automatic total, then a review step with
  issue/due dates before saving. New invoices continue the INV-#### numbering.
- **Invoice details** — a professional, printable document: your business info,
  bill-to, line items, Subtotal → Discount → Final Total, status, and due date.
  Actions: Edit, Mark as Paid, Print, and Save as PDF (via the browser's print
  dialog).
- **Sales** — a sale is a *paid* invoice. The Sales page shows total money received,
  the number of completed sales, and a searchable transaction list with a date
  filter (All time / Last 30 days / Last 90 days / This year). Clicking a sale opens
  its record: customer, items purchased, quantities, Subtotal → Discount → Final
  Total, payment status, and the date of sale. Marking an invoice as paid instantly
  creates the sale everywhere (Overview, Sales page, customer history).
- **Persistence** — customers, products, invoice actions, and business settings
  persist to `localStorage` and sync across browser tabs; the demo survives
  reloads (clear site data to reset to seed numbers). "Overdue" is computed live
  from the due date, so it can never go stale.

## Project structure

```
src/
├── app/
│   ├── layout.tsx                        # Root layout (fonts, metadata)
│   ├── page.tsx                          # Redirects to /dashboard
│   └── dashboard/
│       ├── layout.tsx                    # App shell + customers/invoices providers
│       ├── page.tsx                      # Overview (KPI cards + Recent Sales)
│       ├── customers/
│       │   ├── page.tsx                  # Customers list (search + add)
│       │   └── [id]/page.tsx             # Customer details (edit / delete)
│       ├── invoices/
│       ├── products/page.tsx              # Product catalog (search + add/edit/delete)
│       ├── invoices/
│       │   ├── page.tsx                  # Invoice list (search + status filter)
│       │   ├── new/page.tsx              # Create invoice (3-step form)
│       │   └── [id]/
│       │       ├── page.tsx              # Invoice details (printable document)
│       │       └── edit/page.tsx         # Edit invoice
│       ├── sales/
│       │   ├── page.tsx                  # Sales list (search + date filter)
│       │   └── [id]/page.tsx             # Sale details (paid invoice record)
│       └── settings/page.tsx             # Business Settings (details, currency, logo, discounts)
├── components/
│   ├── layout/                           # Sidebar, Topbar, MobileNav, NavLinks, Brand
│   ├── dashboard/                        # KpiCards, RecentSales
│   ├── customers/                        # CustomerFormModal, DeleteCustomerDialog
│   ├── products/                         # ProductFormModal, DeleteProductDialog
│   ├── invoices/                         # InvoiceForm (create + edit wizard)
│   └── ui/                               # Card, Button, StatusBadge, Sparkline
└── lib/
    ├── types.ts                          # Domain types (API-shaped, backend-ready)
    ├── mock-data.ts                      # Seed records (single swap point)
    ├── invoice-utils.ts                  # Invoice math (incl. discounts), live overdue status
    ├── sales.ts                          # Sales derived from paid invoices
    ├── customer-metrics.ts               # Per-customer totals & outstanding balance
    ├── customers-store.tsx               # localStorage-backed store (useSyncExternalStore)
    ├── invoices-store.tsx                # Same pattern: create/edit/mark-as-paid
    ├── products-store.tsx                # Same pattern: catalog CRUD
    ├── business-store.tsx                # Business settings (enter once, reuse everywhere)
    ├── persistent-store.ts               # Shared store factory (localStorage)
    ├── nav.ts                            # The six nav items (sidebar + mobile)
    └── utils.ts                          # Formatters (currency, dates) and helpers
```

## Design decisions

- **Sales are derived, never stored** — a sale is a paid invoice viewed as a
  transaction (`lib/sales.ts`). Sales can never disagree with invoice amounts,
  discounts, or statuses, and marking an invoice as paid creates the sale
  automatically.
- **Consistent numbers by construction** — every total on every page is *derived*
  from invoices + customers through shared helpers (`invoiceAmount`,
  `salesTotal`). KPI cards, the Sales page, and customer pages all read the same
  stores, so one action updates every number at once.
- **API-shaped mock data** — `lib/types.ts` mirrors what a REST/GraphQL API will return;
  `lib/mock-data.ts` is the only file to swap in a later phase.
- **Business info is entered once** — the business name, logo, phone/WhatsApp,
  address, and currency live in one store and are read by invoices and sales,
  never re-typed. The discount toggle there drives whether the invoice form
  offers discounts.
- **Plain language** — "money received", "Owes Now", "completed sales" instead of
  jargon; empty states tell the user exactly what to do next.
- **Responsive by default** — tables become stacked cards on mobile, the sidebar
  becomes a slide-in drawer with Escape/backdrop close, dialogs bottom-sheet on small screens.
- **Theme tokens** — brand (`--color-brand-*`) and neutral tokens live in
  `src/app/globals.css` via Tailwind v4's CSS-first `@theme`.

## Roadmap (suggested phases)

1. ✅ Dashboard shell + overview page
2. ✅ Restructure for simplicity + Customers (list, details, add/edit/delete)
3. ✅ Invoices: create/edit (3-step form), discounts, mark as paid, print / PDF
4. ✅ Sales & business records (paid-invoice sales, sale details, overview integration)
5. ✅ Business setup (settings form, logo, currency) + product catalog with CRUD,
   discount enable/disable
6. Invoice builder picks products from the catalog; stock awareness
7. Customer/order workflow: quote → invoice → payment → receipt; WhatsApp share
8. Backend integration: swap `lib/mock-data.ts` for real endpoints
