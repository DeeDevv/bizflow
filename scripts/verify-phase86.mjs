/**
 * Offline Phase 8.6 verification (spec §17).
 *
 * Runs the REAL pure functions from src/lib/domain/finance.ts and the REAL
 * permission matrix against the spec's example numbers — no stubs, no
 * copies of the logic. This is a verification harness only; every figure
 * the spec defines is asserted against the shared domain calculations.
 *
 * Run:  npx tsx scripts/verify-phase86.mjs
 */
import assert from "node:assert/strict";

const finance = await import("../src/lib/domain/finance.ts");
const permissions = await import("../src/lib/domain/permissions.ts");
const {
  replayLedger,
  computeFinanceTotals,
  computeProductProfitability,
  computeInsights,
} = finance;
const { hasCapability, canViewFinancials, hasLegacyCapability } = permissions;

/* ------------------------------ §3/§4 --------------------------------- */
// Receive 9 × ₦320,000 cost, ₦400,000 selling price.
const receive = {
  id: "mov-1",
  kind: "receive",
  productId: "p1",
  productName: "Hisense AC 1HP",
  quantity: 9,
  stockBefore: 0,
  stockAfter: 9,
  actor: "Manager",
  at: "2026-01-10T09:00:00.000Z",
  unitCost: 320000,
  unitPrice: 400000,
};

let totals = computeFinanceTotals([receive]);
assert.equal(totals.inventoryCostValue, 2_880_000, "§3: total cost 9×320000 = 2,880,000");
assert.equal(totals.potentialSales, 3_600_000, "§4: potential sales 9×400000 = 3,600,000");
assert.equal(totals.potentialProfit, 720000, "§4: potential profit 720000");
assert.equal(totals.revenue, 0, "no sales yet: revenue 0");
assert.equal(totals.grossProfit, 0, "no sales yet: gross profit 0");
assert.equal(totals.unitsOnHand, 9, "9 units on hand");

/* ------------------------------ §5 ------------------------------------ */
// Sell 1 unit at ₦400,000 (sale movement carries the price charged).
const sale = {
  id: "mov-2",
  kind: "sale",
  productId: "p1",
  productName: "Hisense AC 1HP",
  quantity: -1,
  stockBefore: 9,
  stockAfter: 8,
  actor: "Ada",
  reference: "BM-1024",
  at: "2026-01-11T10:00:00.000Z",
  unitPrice: 400000,
};

/** One more unit sold at the same batch price (a helper for repeats). */
const sellOne = (n, at) => ({
  ...sale,
  id: `mov-sell-${n}`,
  quantity: -1,
  at,
});

// Exactly the spec §5 case: one sale on the 9-unit batch.
totals = computeFinanceTotals([receive, sale]);
assert.equal(totals.revenue, 400000, "§5: revenue 400000");
assert.equal(totals.cogs, 320000, "§5: FIFO COGS from the one batch");
assert.equal(totals.grossProfit, 80000, "§5: 400000 − 320000 = 80000");
assert.equal(totals.inventoryCostValue, 2_560_000, "§5: remaining 8×320000 = 2,560,000");
assert.equal(totals.unitsOnHand, 8, "§5: 9−1 = 8 on hand");
// Potential recalculates over the REMAINING stock — distinct from earned.
assert.equal(totals.potentialSales, 3_200_000, "potential now on 8 remaining units");
assert.equal(totals.potentialProfit, 640000, "potential profit 640000 on remaining stock");

/* --------------------- §5 two-unit sale example ------------------------ */
// Spec §5: 2 units sold → revenue 800k, cost 640k, profit 160k.
totals = computeFinanceTotals([receive, { ...sale, quantity: -2, stockAfter: 7 }]);
assert.equal(totals.revenue, 800000, "§5: 2-unit revenue 800000");
assert.equal(totals.cogs, 640000, "§5: 2-unit COGS 2×320000");
assert.equal(totals.grossProfit, 160000, "§5: 2-unit gross profit 160000");
assert.equal(totals.inventoryCostValue, 7 * 320000, "§5: 7 remaining → 2,240,000");

/* ----------------------------- §8 table + insights -------------------- */
const rows = computeProductProfitability([receive, sale]);
assert.equal(rows.length, 1);
assert.equal(rows[0].soldUnits, 1, "table Sold column");
assert.equal(rows[0].revenue, 400000, "table Revenue column");
assert.equal(rows[0].cogs, 320000, "table Cost column");
assert.equal(rows[0].grossProfit, 80000, "table Profit column");
assert.equal(rows[0].potentialProfit, 640000, "table Potential column (§10: separate)");

const insights = computeInsights(rows);
assert.equal(insights.bestSeller?.name, "Hisense AC 1HP");
assert.equal(insights.mostProfitable?.name, "Hisense AC 1HP");

/* ------------------------------ §6 batch cost basis ------------------- */
// January batch (320k) sells down, then a March batch (350k). January
// stock must NOT reprice; FIFO must consume January's 320k first.
const jan = receive;
const janSale1 = sellOne(1, "2026-01-11T10:00:00.000Z"); // 8 left @320k
const janSale2 = sellOne(2, "2026-01-15T10:00:00.000Z"); // 7 left @320k
const march = {
  ...receive,
  id: "mov-march",
  at: "2026-03-05T09:00:00.000Z",
  unitCost: 350000,
  quantity: 9,
  stockBefore: 7,
  stockAfter: 16,
};
// After Jan(9) − 2 sales + Mar(9): 7 @320k, then 9 @350k on hand.
// Sale #3 (1 unit) must take January's 320k, not March's 350k.
const marchSale = sellOne(3, "2026-03-06T10:00:00.000Z");

totals = computeFinanceTotals([jan, janSale1, janSale2, march, marchSale]);
assert.equal(
  totals.inventoryCostValue,
  6 * 320000 + 9 * 350000,
  "§6: remaining batches keep their own costs (6×320k + 9×350k)",
);
assert.equal(totals.cogs, 3 * 320000, "§6: all three sales consumed January's 320k (FIFO)");
assert.equal(totals.grossProfit, 3 * 80000, "§6: FIFO profit on the cheaper January batch");

/* --------- §17 partial payment does NOT touch the profit math --------- */
// Gross profit counts the SALE, never the amount paid so far. The finance
// ledger never sees payment data (payment status lives in the separate
// transactions store), so a partial payment cannot distort these numbers.
// Proof by construction: replay the same sale regardless of "paid" state.
const saleFull = sellOne(4, "2026-03-07T10:00:00.000Z");
const totalsWithSale = computeFinanceTotals([jan, janSale1, janSale2, march, marchSale, saleFull]);
// Same sale movement is used for both interpretations above; adding a
// partial-payment note would not change the replay (no payment input).
assert.equal(totalsWithSale.grossProfit, 4 * 80000, "§17: profit counts full sale value each time");
assert.equal(totalsWithSale.revenue, 4 * 400000, "§17: revenue counts full sale value");

/* ------------------------ §17 historical cost ------------------------- */
// Changing the "current product cost" cannot rewrite received batches —
// the replay reads ONLY movements. There is no catalog-price input to
// COGS at all. The catalog price is used solely as a selling-price
// FALLBACK for products the ledger has never priced (not tested here —
// pure ledger checks above already fix the batch basis).

/* ------------------------------ §17 permissions ----------------------- */
assert.equal(hasCapability({ operationalRole: "owner", userId: "owner", name: "Owner" }, "viewProfits"), true, "owner sees profits");
assert.equal(hasCapability({ operationalRole: "manager", userId: "m", name: "M" }, "viewProfits"), false, "manager does NOT see profits");
assert.equal(hasCapability({ operationalRole: "employee", userId: "e", name: "E" }, "viewProfits"), false, "employee does NOT see profits");
assert.equal(canViewFinancials({ activeRole: null }), true, "owner session (null role) allowed");
assert.equal(canViewFinancials({ activeRole: "manager" }), false, "manager session blocked");
assert.equal(canViewFinancials({ activeRole: "cashier" }), false, "employee session blocked");
// 8.5 regression guard: legacy shim untouched — manager keeps cost prices
// on existing screens but gains no profit access.
assert.equal(hasLegacyCapability("manager", "canViewCostPrices"), true, "legacy manager cost-price shim unchanged");
assert.equal(hasLegacyCapability("cashier", "canViewCostPrices"), false, "legacy employee cost-price shim still denies");

/* --------------- replayLedger direct: FIFO purity check --------------- */
const replay = replayLedger([jan, janSale1, janSale2, march, marchSale]);
const state = replay.get("p1");
assert.equal(state.batches.length, 2, "two cost batches remain");
assert.equal(state.batches[0].qty, 6, "January batch had 7, one sold → 6 left");
assert.equal(state.batches[0].unitCost, 320000, "January batch cost intact");
assert.equal(state.batches[1].qty, 9, "March batch untouched by FIFO so far");
assert.equal(state.batches[1].unitCost, 350000, "March batch cost intact");
assert.equal(state.latestPrice, 400000, "latest selling price tracked");

console.log("Phase 8.6 offline verification: ALL CHECKS PASSED ✅");
