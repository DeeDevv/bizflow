# BizMate — Product Foundation (Phase 1)

> **You run the business. BizMate handles the details.**

This document is the reference for every future BizMate phase. It records the product
philosophy, the two user experiences, the core business areas, and how today's
implementation maps onto them — so later phases extend the system instead of
re-inventing it.

---

## 1. Product philosophy

**The owner sets up the business. Employees handle the daily work. BizMate handles
the operational details and keeps the owner informed.**

Mental model:

```
Owner sets up once → Employees operate → BizMate processes automatically
                   → Owner receives the important business picture
```

Derived UX rules (binding for all future phases):

1. **Never ask for what BizMate can derive.** Stock levels, revenue, customer
   history, totals, and reports are computed from recorded activity — never
   re-entered by hand.
2. **No duplicate data entry.** A sale is recorded once; everything else (stock,
   customer history, revenue, reports) follows.
3. **Fewer fields beats more fields.** Required = only what BizMate cannot
   infer. Everything else is optional.
4. **The owner reads; the app writes.** Owner screens answer three questions:
   *How is my business doing? What needs my attention? What is BizMate noticing?*
5. **No feature exists because other SaaS products have it.**

## 2. Roles (foundation for later phases)

| | **Owner** | **Employee** |
|---|---|---|
| Purpose | Sees the whole business picture | Performs daily operations |
| Sets up | Business profile, products, settings, employees | — |
| Operates | Monitors: sales, inventory, payments, activity | New Sale → Product → Qty → Customer/Walk-in → Payment → Complete |
| Sees | Dashboards, reports, things needing attention | Only what their work requires |

Rules established now:

- The **owner experience** is monitoring-first: summaries, attention items,
  notifications — not constant operation.
- The **employee experience** is operation-first: the primary workflow is the
  sale flow above. Stock deduction, revenue, customer history, and reporting are
  BizMate's job (automation in later phases), never the employee's.
- **Role-based access arrives in a later phase** (with the new Supabase project).
  The UI structure must not assume a single-user app: screens are grouped by
  concern (setup vs. operate vs. monitor) so permission checks can be added
  without restructuring.

## 3. Core business areas → current state

| Area | Existing implementation (keep & extend) | Later phases add |
|---|---|---|
| **Business** | Setup gate + Settings (profile, currency, discounts, website URL) | Multi-user ownership |
| **Products** | Products page, form modal, delete dialog, stock field | Cost price, category/brand, low-stock threshold, category-aware details |
| **Employees** | — (clean foundation only; do not build yet) | Accounts, roles, permissions |
| **Customers** | Customers page, search, form modal, detail page | Auto history from sales activity |
| **Sales** | Sales page + sale detail; paid invoices appear as sales | Employee-operated POS-style sale flow |
| **Payments** | Payment recording on invoices, partial payments, status engine | Payment-method clarity; employee recording |
| **Inventory** | `products.stock`, DB-side atomic deduction on finalize, oversell block | Receive stock, returns, authorised adjustments, low-stock alerts |
| **Reports** | Overview KPIs + Recent Sales (revenue = real payments) | Deeper summaries for the owner |
| **Activity/History** | — (foundation only) | Activity log: who sold / received / adjusted, and when |
| **Notifications** | Topbar bell: overdue invoices + low stock | BizMate-noticed events beyond stock/overdue |

## 4. Architecture snapshot (what future phases build on)

- **Next.js 16 App Router + TypeScript + Tailwind v4.** Fonts: Inter (body) +
  Plus Jakarta Sans (headings). Brand assets: `/bizmate-logo.png` (lockup),
  `src/app/icon.png` (mark/favicon).
- **Supabase-first stores with demo fallback.** Every store
  (`business/products/customers/invoices`) loads from the DB layer
  (`*-db.ts`) and only falls back to `mock-data.ts` seeds when Supabase is not
  configured — so the UI remains runnable before the new backend exists.
  `persistent-store.ts` backs local caching only; it is not the system of record.
- **Money safety lives in the database** (atomic stock deduction, payment
  validation, receipt snapshots) — replicated client-side rules are display-only.
- **Business isolation** via owner-scoped RLS; every query is business-scoped.
- **Dependencies stay minimal**: next, react, supabase-js/ssr, lucide-react.

### Transition plan to the new Supabase project (no work done yet, by design)

1. Finish UI/application phases first.
2. Create a fresh Git repository; push the finished app.
3. Create a new Supabase project; run a consolidated schema migration derived
   from `supabase/migrations/0001–0011` (single-tenant pre-auth policies from
   0002–0004 are historical and will **not** be recreated — 0009-style
   owner-scoped RLS is the template).
4. Expected schema **additions** when the later phases arrive (not before):
   `employees` (+ role), product `category`/`brand`/`cost_price`/
   `low_stock_threshold`, `activity_log`, and stock-movement records.
5. Connect via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (publishable key only; the secret/service key never touches the client).

### Naming rules

- User-facing identity: **BizMate** everywhere. No exceptions.
- Technical identifiers that already exist in the **live database**
  (`bizmate_anon_*`/`bizmate_owner_*` RLS policy names, migration filenames,
  the `bizmate.business.v1` localStorage cache key — renamed in the bizmate
  repo migration; the old bizflow names stay untouched in the BizFlow backup)
  as-is until the new Supabase project is created — renaming them now would
  desync code from the running database. When the new project is provisioned,
  the new migrations will use `bizmate_*` naming from the start.
