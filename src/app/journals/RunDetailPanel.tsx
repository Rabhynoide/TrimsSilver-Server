"use client";

import type { BuyLine, EvalResult, JournalRow, SellLine } from "./calc";
import { JOURNAL_FAMILIES } from "@/data/journal-constants";
import type { JournalsConfig } from "./types";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function iconUrl(marketId: string | null): string {
  const id = (marketId ?? "").replace("_FULL", "");
  return `https://render.albiononline.com/v1/item/${id}.png`;
}

function BuyLineRow({ line }: { line: BuyLine }) {
  return (
    <div className="flex items-center gap-3 rounded border border-navy-700 bg-navy-900 px-3 py-2">
      {line.marketId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl(line.marketId)} alt="" className="h-8 w-8 shrink-0" />
      )}
      <div className="flex flex-1 flex-col">
        <span className="text-sm text-navy-100">{line.label}</span>
        <span className="text-xs text-navy-400">
          Qty: {line.qtyPerJournal.toFixed(2)} · Unit price:{" "}
          {line.unitPrice != null ? money(line.unitPrice) : "—"}
          {line.setupFee > 0 && <> · Setup fee: {money(line.setupFee)}</>}
        </span>
      </div>
      <span className="text-sm font-semibold text-navy-100">{money(line.cost)}</span>
    </div>
  );
}

function SellLineRow({ line }: { line: SellLine }) {
  return (
    <div className="flex items-center gap-3 rounded border border-navy-700 bg-navy-900 px-3 py-2">
      {line.itemName !== "Silver" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl(line.itemName)} alt="" className="h-8 w-8 shrink-0" />
      )}
      <div className="flex flex-1 flex-col">
        <span className="text-sm text-navy-100">{line.itemName}</span>
        <span className="text-xs text-navy-400">
          Qty: {line.qtyPerJournal.toFixed(3)} · Unit price:{" "}
          {line.unitPrice != null ? money(line.unitPrice) : "—"}
          {line.setupFee > 0 && <> · Setup fee: {money(line.setupFee)}</>}
          {line.salesTax > 0 && <> · Sales tax: {money(line.salesTax)}</>}
        </span>
      </div>
      <span className={`text-sm font-semibold ${line.result >= 0 ? "text-navy-100" : "text-red-400"}`}>
        {money(line.result)}
      </span>
    </div>
  );
}

export default function RunDetailPanel({
  row,
  result,
  config,
  onFillChoiceChange,
  onManualFillCostChange,
  onManualPriceChange,
}: {
  row: JournalRow;
  result: EvalResult;
  config: JournalsConfig;
  onFillChoiceChange: (uniqueName: string, fillUniqueName: string) => void;
  onManualFillCostChange: (uniqueName: string, value: number) => void;
  onManualPriceChange: (marketId: string, value: number) => void;
}) {
  const familyMeta = JOURNAL_FAMILIES[row.family];
  const hasMissing = result.missingPrices.length > 0;
  const chosenFill = config.fillChoice[row.uniqueName] ?? row.fillOptions?.[0]?.uniqueName ?? null;

  return (
    <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-navy-400">
        Journal Run Details
      </h2>
      <p className="mb-3 text-lg font-semibold text-navy-100">
        {familyMeta.label} [T{row.tier}]
      </p>

      {row.fillOptions && config.scenario !== "buyFullSellMats" && (
        <label className="mb-3 flex max-w-md flex-col gap-1 text-sm text-navy-300">
          Fill with
          <select
            value={chosenFill ?? ""}
            onChange={(e) => onFillChoiceChange(row.uniqueName, e.target.value)}
            className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
          >
            {row.fillOptions.map((opt) => (
              <option key={opt.uniqueName} value={opt.uniqueName}>
                {opt.uniqueName} ({opt.famevalue} fame/unit → {(row.maxFame / opt.famevalue).toFixed(1)} units)
              </option>
            ))}
          </select>
        </label>
      )}

      {result.usingManualFillCost && config.scenario !== "buyFullSellMats" && (
        <label className="mb-3 flex max-w-xs flex-col gap-1 text-sm text-navy-300">
          Fill cost per journal (manual)
          <input
            type="number"
            min={0}
            value={config.manualFillCost[row.uniqueName] ?? 0}
            onChange={(e) => onManualFillCostChange(row.uniqueName, parseInt(e.target.value, 10) || 0)}
            className="w-32 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
          />
          <span className="text-xs text-navy-400">
            {familyMeta.kind === "manual-fill"
              ? "No market-priceable fill input for this journal type (crafting fame, PvE kill fame, or any-fame-source) — enter your own cost."
              : null}
          </span>
        </label>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
            Buy — Total cost {money(result.costPerJournal)}
          </h3>
          <div className="flex flex-col gap-2">
            {result.buyLines.map((line, i) => (
              <BuyLineRow key={i} line={line} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
            Sell — Net income {money(result.revenuePerJournal)}
          </h3>
          <div className="flex flex-col gap-2">
            {result.sellLines.map((line, i) => (
              <SellLineRow key={i} line={line} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 border-t border-navy-700 pt-3">
        <span className="text-sm text-navy-300">
          Profit / journal:{" "}
          <span className={result.profitPerJournal >= 0 ? "text-green-400" : "text-red-400"}>
            {money(result.profitPerJournal)}
          </span>
        </span>
        <span className="text-sm text-navy-300">
          Profit × {config.amount}:{" "}
          <span className={`font-semibold ${result.profitTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
            {money(result.profitTotal)}
          </span>
        </span>
      </div>

      {hasMissing && (config.buyPriceType === "manual" || config.sellPriceType === "manual") ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.missingPrices.map((id) => (
            <label key={id} className="flex items-center gap-1 text-xs text-navy-300">
              {id}
              <input
                type="number"
                min={0}
                value={config.manualPrices[id] ?? ""}
                onChange={(e) => onManualPriceChange(id, parseInt(e.target.value, 10) || 0)}
                className="w-24 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
              />
            </label>
          ))}
        </div>
      ) : (
        hasMissing && (
          <p className="mt-3 text-xs text-amber-400">Missing price for: {result.missingPrices.join(", ")}</p>
        )
      )}
    </section>
  );
}
