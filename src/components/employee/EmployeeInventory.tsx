"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  CircleSlash,
  PackagePlus,
  PackageSearch,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StockStatusPill } from "./StockStatusPill";
import { useProducts } from "@/lib/products-store";
import { useBusiness } from "@/lib/business-store";
import { useEmployeeSession } from "@/lib/employee-session";
import { hasCapability } from "@/lib/domain/permissions";
import {
  stockStatus,
  stockStatusLabel,
  lowStockThreshold,
  type StockStatus,
} from "@/lib/domain/stock-state";
import { useStockMovements } from "@/lib/domain/stock-movements";
import {
  productCode,
  productCategory,
  productBrand,
  productCostPrice,
  productSearchText,
} from "@/lib/product-meta";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { cn } from "@/lib/utils";

/**
 * Inventory (Phase 5) — the operational home: what stock we have, what is
 * running low, and what is finished. All stock status comes from the Phase 4
 * stock-state logic (ONE source); every mutation stays behind the automation
 * engine — this view only reads and links.
 */

type StatusFilter = "all" | StockStatus;
type SortKey = "name" | "stock" | "attention" | "recent";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: "attention", label: "Low stock first" },
  { value: "name", label: "Name" },
  { value: "stock", label: "Stock" },
  { value: "recent", label: "Recently updated" },
];

/** Status → rank for "low stock first": attention problems bubble up. */
const ATTENTION_RANK: Record<StockStatus, number> = { out: 0, low: 1, in: 2 };

export function EmployeeInventory() {
  const { products, status: productsStatus, error, reload } = useProducts();
  const { business } = useBusiness();
  const session = useEmployeeSession();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [sort, setSort] = useState<SortKey>("attention");

  const router = useRouter();
  const role = session.activeRole;
  const canReceive = hasCapability(role, "canReceiveStock");
  // Cost-price figures are owner/manager level (capability-gated, spec §17/§21).
  const canSeeCosts = hasCapability(role, "canViewCostPrices");

  // Real "recently updated" timestamps come from the movement ledger.
  const movements = useStockMovements();
  const recentByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movements) {
      if (!map.has(m.productId)) map.set(m.productId, m.at); // newest first
    }
    return map;
  }, [movements]);

  // Derived summary — nothing hardcoded (spec §40).
  const summary = useMemo(() => {
    let totalUnits = 0;
    let low = 0;
    let out = 0;
    for (const p of products) {
      totalUnits += p.stock;
      const s = stockStatus(p);
      if (s === "low") low += 1;
      if (s === "out") out += 1;
    }
    return { total: products.length, totalUnits, low, out };
  }, [products]);

  // Filter facets from the actual catalog.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const c = productCategory(p.name);
      if (c) set.add(c);
    }
    return ["All", ...[...set].sort()];
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const b = productBrand(p.name);
      if (b) set.add(b);
    }
    return ["All", ...[...set].sort()];
  }, [products]);

  // Inventory value at cost: cost price × stock, only where the owner
  // captured a cost price — never invented (spec §21).
  const valueInfo = useMemo(() => {
    let value = 0;
    let priced = 0;
    for (const p of products) {
      const cost = productCostPrice(p.name);
      if (cost !== null) {
        value += cost * p.stock;
        priced += 1;
      }
    }
    return { value, priced, missing: products.length - priced };
  }, [products]);

  // Search (immediate) + filters + sort.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (statusFilter !== "all" && stockStatus(p) !== statusFilter) return false;
      if (category !== "All" && productCategory(p.name) !== category) return false;
      if (brand !== "All" && productBrand(p.name) !== brand) return false;
      if (!q) return true;
      return productSearchText(p.name).includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "stock":
          return b.stock - a.stock;
        case "recent":
          return (
            (recentByProduct.get(b.id) ?? "").localeCompare(
              recentByProduct.get(a.id) ?? "",
            ) || b.id.localeCompare(a.id)
          );
        case "attention":
        default: {
          const byStatus = ATTENTION_RANK[stockStatus(a)] - ATTENTION_RANK[stockStatus(b)];
          if (byStatus !== 0) return byStatus;
          return a.name.localeCompare(b.name);
        }
      }
    });

    return list;
  }, [products, query, statusFilter, category, brand, sort, recentByProduct]);

  const filtersActive =
    query.trim() !== "" || statusFilter !== "all" || category !== "All" || brand !== "All";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">Current stock at a glance.</p>
        </div>
        {canReceive ? (
          <Button onClick={() => router.push("/dashboard/employee/receive-stock")}>
            <PackagePlus aria-hidden className="h-4 w-4" />
            Receive Stock
          </Button>
        ) : null}
      </div>

      {/* Summary — derived from the live catalog */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard icon={Boxes} label="Total Products" value={String(summary.total)} />
        <SummaryCard
          icon={AlertTriangle}
          label="Low Stock"
          value={String(summary.low)}
          tone={summary.low > 0 ? "amber" : "default"}
        />
        <SummaryCard
          icon={CircleSlash}
          label="Out of Stock"
          value={String(summary.out)}
          tone={summary.out > 0 ? "red" : "default"}
        />
        <SummaryCard
          icon={PackageSearch}
          label="Total Units"
          value={summary.totalUnits.toLocaleString("en-US")}
        />
      </div>

      {/* Inventory value at cost — capability-gated, only where cost prices exist */}
      {canSeeCosts && products.length > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          {valueInfo.priced === 0
            ? "Add cost prices in setup to value this inventory."
            : `Inventory value (at cost): ${formatMoneyWhole(valueInfo.value, business.currency || "NGN")}${
                valueInfo.missing > 0
                  ? ` · cost price missing for ${valueInfo.missing} product${valueInfo.missing === 1 ? "" : "s"}`
                  : ""
              }`}
        </p>
      ) : null}

      {/* Search — immediate, name/code/brand/category */}
      <div className="relative mt-4 max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, code, brand…"
          aria-label="Search inventory"
          className="w-full rounded-lg border border-zinc-300 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Filters + sort */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Filter by stock status"
          className="flex rounded-lg border border-zinc-200 bg-surface p-0.5"
        >
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={statusFilter === t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === t.value
                  ? "bg-brand-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-surface px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All categories" : c}
            </option>
          ))}
        </select>

        {brands.length > 2 ? (
          <select
            aria-label="Filter by brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-surface px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b === "All" ? "All brands" : b}
              </option>
            ))}
          </select>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <ArrowDownUp aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-zinc-300 bg-surface px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {productsStatus === "error" ? (
        <Card className="mt-4 px-6 py-10 text-center">
          <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">
            We couldn&apos;t load your inventory right now.
          </p>
          <p className="mt-1 text-sm text-zinc-500">{error ?? "Please try again."}</p>
          <Button variant="secondary" className="mt-4" onClick={reload}>
            Try again
          </Button>
        </Card>
      ) : productsStatus === "loading" ? (
        /* Loading skeleton — keeps the layout from jumping */
        <ul className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-16 animate-pulse rounded-xl border border-zinc-100 bg-zinc-50"
            />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        /* Empty states (spec §36) */
        <Card className="mt-4 px-6 py-12 text-center">
          <PackageSearch aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          {products.length === 0 ? (
            <>
              <p className="mt-3 text-sm font-medium text-zinc-900">No products yet</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                Products added during setup appear here.
              </p>
            </>
          ) : filtersActive ? (
            <>
              <p className="mt-3 text-sm font-medium text-zinc-900">No products found</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                Try a different search or clear the filters.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setCategory("All");
                  setBrand("All");
                }}
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-zinc-900">
                Everything is sufficiently stocked
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                No low or out-of-stock products right now.
              </p>
            </>
          )}
        </Card>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-surface shadow-card">
          {rows.map((p) => {
            const status = stockStatus(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/employee/inventory/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {[productCode(p.name), productBrand(p.name), productCategory(p.name)]
                        .filter((part) => part && part !== "—")
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-zinc-900">{p.stock}</p>
                    <p className="text-[11px] tabular-nums text-zinc-400">
                      {status === "in" ? `Low at ${lowStockThreshold(p)}` : " "}
                    </p>
                  </div>
                  <StockStatusPill status={status} label={stockStatusLabel[status]} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  tone?: "default" | "amber" | "red";
}) {
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          className={cn(
            "h-4 w-4",
            tone === "amber" && "text-amber-500",
            tone === "red" && "text-red-500",
            tone === "default" && "text-zinc-400",
          )}
        />
        <p className="truncate text-xs font-medium text-zinc-500">{label}</p>
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
          tone === "amber" && "text-amber-700",
          tone === "red" && "text-red-700",
          tone === "default" && "text-zinc-900",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

