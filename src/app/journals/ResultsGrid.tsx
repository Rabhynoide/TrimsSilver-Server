"use client";

import { JOURNAL_FAMILIES, JOURNAL_FAMILY_ORDER, JOURNAL_TIERS } from "@/data/journal-constants";
import type { EvalResult, JournalRow } from "./calc";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function ResultsGrid({
  rowsByFamily,
  evaluate,
  selected,
  onSelect,
}: {
  rowsByFamily: Map<string, Map<number, JournalRow>>;
  evaluate: (row: JournalRow) => EvalResult;
  selected: JournalRow | null;
  onSelect: (row: JournalRow) => void;
}) {
  return (
    <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Tableau des résultats</h2>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="divide-x divide-navy-700 border-b border-navy-700 text-left text-xs uppercase tracking-wide text-navy-400">
              <th className="w-56 px-2 py-1.5">Type de registre</th>
              {JOURNAL_TIERS.map((tier) => (
                <th key={tier} className="w-20 px-2 py-1.5 text-right">
                  T{tier}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JOURNAL_FAMILY_ORDER.map((family) => {
              const tierRows = rowsByFamily.get(family);
              if (!tierRows) return null;
              return (
                <tr key={family} className="divide-x divide-navy-800 border-b border-navy-800">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://render.albiononline.com/v1/item/T4_JOURNAL_${family}.png`}
                        alt=""
                        className="h-6 w-6 shrink-0"
                      />
                      <span className="truncate text-navy-100">{JOURNAL_FAMILIES[family].label}</span>
                    </div>
                  </td>
                  {JOURNAL_TIERS.map((tier) => {
                    const row = tierRows.get(tier);
                    if (!row) {
                      return <td key={tier} className="px-2 py-1.5 text-right text-navy-600">—</td>;
                    }
                    const result = evaluate(row);
                    const isSelected = selected?.uniqueName === row.uniqueName;
                    return (
                      <td key={tier} className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => onSelect(row)}
                          className={`w-full rounded px-2 py-1 text-right transition-colors ${
                            isSelected
                              ? "bg-gold-500 text-navy-950 font-semibold"
                              : result.profitTotal >= 0
                                ? "text-green-400 hover:bg-navy-700"
                                : "text-red-400 hover:bg-navy-700"
                          }`}
                          title={
                            result.missingPrices.length > 0
                              ? `Prix manquant pour : ${result.missingPrices.join(", ")}`
                              : undefined
                          }
                        >
                          {money(result.profitTotal)}
                          {result.missingPrices.length > 0 && !isSelected && (
                            <span className="ml-1 text-amber-400">!</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
