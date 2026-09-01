"use client";

import { useMemo, useState } from "react";
import { itemTierFromUniqueName, type FinalItemResult } from "./calc";
import type { CraftFinderConfig } from "./types";

const STALE_PRICE_HOURS = 12;

type SortKey = "name" | "tier" | "marginNet" | "marginPct" | "silverPerFocus" | "saleRate";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function hoursSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

export default function RankingTable({
  rows,
  nameOf,
  config,
  onOpenTree,
}: {
  rows: FinalItemResult[];
  nameOf: (uniqueName: string) => string;
  config: CraftFinderConfig;
  onOpenTree: (uniqueName: string, enchant: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("marginNet");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = nameOf(a.uniqueName).localeCompare(nameOf(b.uniqueName));
      else if (sortKey === "tier")
        cmp = itemTierFromUniqueName(a.uniqueName) - itemTierFromUniqueName(b.uniqueName);
      else if (sortKey === "marginNet") cmp = (a.marginNet ?? -Infinity) - (b.marginNet ?? -Infinity);
      else if (sortKey === "marginPct") cmp = (a.marginPct ?? -Infinity) - (b.marginPct ?? -Infinity);
      else if (sortKey === "silverPerFocus") cmp = (a.silverPerFocus ?? -Infinity) - (b.silverPerFocus ?? -Infinity);
      else if (sortKey === "saleRate") cmp = (a.saleRate ?? -1) - (b.saleRate ?? -1);
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, sortDesc, nameOf]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const headers: { key: SortKey | null; label: string; align: string; width: string }[] = [
    { key: "name", label: "Objet", align: "text-left", width: "w-64" },
    { key: "tier", label: "Tier", align: "text-center", width: "w-14" },
    { key: null, label: "Ench.", align: "text-center", width: "w-14" },
    { key: null, label: "Coût de craft", align: "text-right", width: "w-28" },
    { key: null, label: "Vente nette", align: "text-right", width: "w-28" },
    { key: "marginNet", label: "Marge", align: "text-right", width: "w-24" },
    { key: "marginPct", label: "Marge %", align: "text-right", width: "w-20" },
    { key: "silverPerFocus", label: "Argent/Focus", align: "text-right", width: "w-24" },
    { key: "saleRate", label: "Ventes/jour", align: "text-right", width: "w-24" },
    { key: null, label: "", align: "text-right", width: "w-28" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
        Classement ({sorted.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-navy-700">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={h.key ? () => toggleSort(h.key as SortKey) : undefined}
                  className={`${h.width} px-2 py-2 text-xs font-medium uppercase tracking-wide ${h.align} ${
                    h.key ? "cursor-pointer hover:text-navy-100" : ""
                  }`}
                >
                  {h.label}
                  {h.key && sortKey === h.key ? (sortDesc ? " ▼" : " ▲") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const ageHours = hoursSince(row.sellPriceAge);
              const isStale = ageHours != null && ageHours >= STALE_PRICE_HOURS;
              const hasMissing = row.missingPrices.length > 0;
              return (
                <tr
                  key={`${row.uniqueName}|${row.enchant}`}
                  className="divide-x divide-navy-700 border-b border-navy-800 hover:bg-navy-800/50"
                >
                  <td className="px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://render.albiononline.com/v1/item/${row.uniqueName}.png`}
                        alt=""
                        className="h-7 w-7 shrink-0"
                      />
                      <span className="truncate text-sm text-navy-100">{nameOf(row.uniqueName)}</span>
                      {hasMissing && (
                        <span
                          title={`Prix manquants : ${row.missingPrices.join(", ")}`}
                          className="shrink-0 rounded bg-amber-800 px-1 text-[10px] text-amber-100"
                        >
                          !
                        </span>
                      )}
                      {isStale && (
                        <span
                          title={`Prix de vente vieux de ${Math.round(ageHours!)}h`}
                          className="shrink-0 rounded bg-red-900 px-1 text-[10px] text-red-100"
                        >
                          ⟳ {Math.round(ageHours!)}h
                        </span>
                      )}
                      {row.liquidityOk === false && (
                        <span
                          title={`Volume faible : ${row.saleRate ?? 0} ventes/jour, sous le seuil pour ce tier`}
                          className="shrink-0 rounded bg-amber-900 px-1 text-[10px] text-amber-200"
                        >
                          illiquide
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center text-sm text-navy-300">
                    {itemTierFromUniqueName(row.uniqueName)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-sm text-navy-300">{row.enchant}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-navy-300">{money(row.craft.craftCost)}</td>
                  <td className="px-2 py-1.5 text-right text-sm text-navy-300">
                    {row.sellPriceNet != null ? money(row.sellPriceNet) : "-"}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right text-sm font-semibold ${
                      (row.marginNet ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {row.marginNet != null ? money(row.marginNet) : "-"}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right text-sm ${
                      (row.marginPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {row.marginPct != null ? `${(row.marginPct * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm text-navy-300">
                    {row.silverPerFocus != null ? row.silverPerFocus.toFixed(2) : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm text-navy-300">
                    {row.saleRate != null ? row.saleRate.toFixed(1) : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenTree(row.uniqueName, row.enchant)}
                      className="rounded border border-navy-600 px-2 py-1 text-xs text-navy-200 hover:bg-navy-700"
                    >
                      Voir l&apos;arbre
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-4 py-6 text-center text-sm text-navy-400">
                  {config.onlyLiquid
                    ? "Aucun objet liquide ne correspond aux filtres actuels."
                    : "Aucun résultat — vérifiez les prix ou élargissez les filtres."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
