import { journalMarketId, type JournalFamily } from "@/data/journal-constants";
import type { Scenario } from "./types";

export type LootEntry =
  | { itemName: string; itemAmount: number; weight: number; enchant: number }
  | { silverAmount: number; weight: number };

export type FillOption = { uniqueName: string; famevalue: number };

export type JournalRow = {
  uniqueName: string;
  family: JournalFamily;
  tier: number;
  emptySilver: number;
  maxFame: number;
  baseLootAmount: number;
  loot: LootEntry[];
  fillOptions: FillOption[] | null;
};

export type EvalContext = {
  scenario: Scenario;
  amount: number;
  yieldPct: number;
  salesTaxRate: number;
  setupFeeRate: number;
  // Whether a setup fee is charged on this leg — true iff you're placing your
  // own resting order on that side (Buy leg + "Buy Order" price type, or Sell
  // leg + "Sell Order" price type). See types.ts's PriceType doc.
  buySetupFeeApplies: boolean;
  sellSetupFeeApplies: boolean;
  buyPriceOf: (marketId: string) => number | null;
  sellPriceOf: (marketId: string) => number | null;
  fillChoiceFor: (row: JournalRow) => string | null;
  manualFillCostFor: (row: JournalRow) => number | null;
};

export type BuyLine = {
  label: string;
  marketId: string | null;
  qtyPerJournal: number;
  unitPrice: number | null;
  setupFee: number;
  cost: number;
};

export type SellLine = {
  itemName: string;
  qtyPerJournal: number;
  unitPrice: number | null;
  setupFee: number;
  salesTax: number;
  result: number;
};

export type EvalResult = {
  buyLines: BuyLine[];
  sellLines: SellLine[];
  costPerJournal: number;
  revenuePerJournal: number;
  profitPerJournal: number;
  costTotal: number;
  revenueTotal: number;
  profitTotal: number;
  missingPrices: string[];
  usingManualFillCost: boolean;
};

function buyLine(label: string, marketId: string | null, qty: number, unitPrice: number | null, ctx: EvalContext): BuyLine {
  const base = (unitPrice ?? 0) * qty;
  const setupFee = ctx.buySetupFeeApplies ? base * ctx.setupFeeRate : 0;
  return { label, marketId, qtyPerJournal: qty, unitPrice, setupFee, cost: base + setupFee };
}

function sellLine(itemName: string, qty: number, unitPrice: number | null, ctx: EvalContext): SellLine {
  const base = (unitPrice ?? 0) * qty;
  const setupFee = ctx.sellSetupFeeApplies ? base * ctx.setupFeeRate : 0;
  const salesTax = base * ctx.salesTaxRate;
  return { itemName, qtyPerJournal: qty, unitPrice, setupFee, salesTax, result: base - setupFee - salesTax };
}

// Expected units of a specific reward SKU per journal delivered, at 100%
// weight-share within its lootlist: baseLootAmount * yield% * (this entry's
// weight / total weight) * itemAmount. See build-journal-catalog.mjs — the
// lootlist weights are the exact, authoritative in-game reward table, so this
// expected-value computation needs no separate enchant-distribution constant.
function expectedShare(row: JournalRow, entry: LootEntry, yieldPct: number): number {
  const totalWeight = row.loot.reduce((sum, l) => sum + l.weight, 0);
  const share = totalWeight > 0 ? entry.weight / totalWeight : 0;
  const amount = "silverAmount" in entry ? entry.silverAmount : entry.itemAmount;
  return row.baseLootAmount * (yieldPct / 100) * share * amount;
}

export function evaluateJournal(row: JournalRow, ctx: EvalContext): EvalResult {
  const missing: string[] = [];
  const buyLines: BuyLine[] = [];
  const sellLines: SellLine[] = [];
  let usingManualFillCost = false;

  const emptyId = journalMarketId(row.uniqueName, "empty");
  const fullId = journalMarketId(row.uniqueName, "full");

  // ---- Buy side ----
  if (ctx.scenario === "buyFullSellMats") {
    const price = ctx.buyPriceOf(fullId);
    if (price == null) missing.push(fullId);
    buyLines.push(buyLine("Full journal", fullId, 1, price, ctx));
  } else {
    // Empty journals ARE real player-market goods (confirmed in-game — real
    // sell orders at varying prices), but AODP currently has no scan coverage
    // for the bare uniqueName at all (confirmed live: every T*_JOURNAL_* id
    // returns zero data in every region/city/quality, and no history either).
    // row.emptySilver (from craftingrequirements.@silver — the NPC vendor's
    // fixed instant-buy price) is a reliable ceiling no rational buyer pays
    // above, and matches observed player listings clustering right at/under
    // it. Prefer live data when AODP has it (in case their coverage improves)
    // and fall back to the vendor price otherwise — never "missing".
    const price = ctx.buyPriceOf(emptyId) ?? row.emptySilver;
    buyLines.push(buyLine("Empty journal", emptyId, 1, price, ctx));

    if (row.fillOptions && row.fillOptions.length > 0) {
      const chosenId = ctx.fillChoiceFor(row) ?? row.fillOptions[0].uniqueName;
      const option = row.fillOptions.find((o) => o.uniqueName === chosenId) ?? row.fillOptions[0];
      const units = row.maxFame / option.famevalue;
      const fillPrice = ctx.buyPriceOf(option.uniqueName);
      if (fillPrice == null) missing.push(option.uniqueName);
      buyLines.push(buyLine(`Fill: ${option.uniqueName}`, option.uniqueName, units, fillPrice, ctx));
    } else {
      usingManualFillCost = true;
      const manualCost = ctx.manualFillCostFor(row) ?? 0;
      buyLines.push({
        label: "Fill cost (manual)",
        marketId: null,
        qtyPerJournal: 1,
        unitPrice: manualCost,
        setupFee: 0,
        cost: manualCost,
      });
    }
  }

  // ---- Sell side ----
  if (ctx.scenario === "buyEmptySellFull") {
    const price = ctx.sellPriceOf(fullId);
    if (price == null) missing.push(fullId);
    sellLines.push(sellLine(fullId, 1, price, ctx));
  } else {
    // Turning in a filled journal returns the (now empty) journal itself
    // along with the loot — same live-price-first, vendor-price-fallback
    // reasoning as the buy side.
    const emptyBackPrice = ctx.sellPriceOf(emptyId) ?? row.emptySilver;
    sellLines.push(sellLine(emptyId, 1, emptyBackPrice, ctx));

    for (const entry of row.loot) {
      const expected = expectedShare(row, entry, ctx.yieldPct);
      if ("silverAmount" in entry) {
        // Mercenary journals return raw silver, not a tradable item — no
        // market price, no tax/fee, it's just delivered.
        sellLines.push({ itemName: "Silver", qtyPerJournal: expected, unitPrice: 1, setupFee: 0, salesTax: 0, result: expected });
      } else {
        const price = ctx.sellPriceOf(entry.itemName);
        if (price == null) missing.push(entry.itemName);
        sellLines.push(sellLine(entry.itemName, expected, price, ctx));
      }
    }
  }

  const costPerJournal = buyLines.reduce((sum, l) => sum + l.cost, 0);
  const revenuePerJournal = sellLines.reduce((sum, l) => sum + l.result, 0);
  const profitPerJournal = revenuePerJournal - costPerJournal;

  return {
    buyLines,
    sellLines,
    costPerJournal,
    revenuePerJournal,
    profitPerJournal,
    costTotal: costPerJournal * ctx.amount,
    revenueTotal: revenuePerJournal * ctx.amount,
    profitTotal: profitPerJournal * ctx.amount,
    missingPrices: [...new Set(missing)],
    usingManualFillCost,
  };
}
