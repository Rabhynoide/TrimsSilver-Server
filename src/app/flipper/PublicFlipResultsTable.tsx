"use client";

import { useMemo, useState } from "react";
import { itemId, QUALITY_LABELS } from "../market-prices/types";
import type { SelectedItem } from "../market-prices/types";
import type { PublicFlipOpportunity } from "./calc";

type SortKey = "profitPerUnit" | "roi" | "buyPrice" | "avgAmount";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function ageLabel(dateStr: string): string {
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function FlipRow({ flip, item }: { flip: PublicFlipOpportunity; item: SelectedItem | undefined }) {
  const name = item?.name ?? flip.itemId;

  return (
    <tr className="divide-x divide-navy-700 border-b border-navy-800 hover:bg-navy-800/50">
      <td className="w-64 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://render.albiononline.com/v1/item/${flip.itemId}.png`} alt="" className="h-7 w-7 shrink-0" />
          <span className="truncate text-sm text-navy-100">{name}</span>
        </div>
      </td>
      <td className="w-28 px-2 py-1.5 text-center text-xs text-navy-300">
        {item?.hasQuality ? QUALITY_LABELS[flip.qualityLevel] : "-"}
      </td>
      <td className="w-56 px-2 py-1.5 text-xs text-navy-300">
        <div className="flex items-center gap-1 truncate">
          <span>{flip.sourceCity}</span>
          <span className="text-navy-500">→</span>
          <span className={flip.isBlackMarketFlip ? "font-semibold text-red-300" : ""}>{flip.destCity}</span>
        </div>
      </td>
      <td className="w-24 px-2 py-1.5 text-right text-sm text-navy-300">{money(flip.buyPrice)}</td>
      <td className="w-24 px-2 py-1.5 text-right text-sm text-navy-300">{money(flip.netSellPrice)}</td>
      <td
        className={`w-24 px-2 py-1.5 text-right text-sm font-semibold ${
          flip.profitPerUnit >= 0 ? "text-green-400" : "text-red-400"
        }`}
      >
        {money(flip.profitPerUnit)}
      </td>
      <td className="w-20 px-2 py-1.5 text-right text-sm text-navy-300">{(flip.roi * 100).toFixed(1)}%</td>
      <td className="w-24 px-2 py-1.5 text-right text-sm text-navy-300">
        {flip.avgAmount != null ? flip.avgAmount.toLocaleString() : "-"}
      </td>
      <td
        className="w-24 px-2 py-1.5 text-right text-xs text-navy-400"
        title={`Âge du prix de vente à ${flip.sourceCity}`}
      >
        {ageLabel(flip.buyPriceDate)}
      </td>
      <td
        className="w-24 px-2 py-1.5 text-right text-xs text-navy-400"
        title={`Âge du prix d'achat à ${flip.destCity}`}
      >
        {ageLabel(flip.sellPriceDate)}
      </td>
    </tr>
  );
}

export default function PublicFlipResultsTable({
  flips,
  selectedItems,
}: {
  flips: PublicFlipOpportunity[];
  selectedItems: SelectedItem[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("profitPerUnit");
  const [sortDesc, setSortDesc] = useState(true);

  const byId = useMemo(() => new Map(selectedItems.map((i) => [itemId(i), i])), [selectedItems]);

  const sorted = useMemo(() => {
    const copy = [...flips];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      const cmp = av - bv;
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [flips, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  if (selectedItems.length === 0) {
    return (
      <p className="text-sm text-navy-400">
        Sélectionnez des objets ci-dessus pour scanner les prix publics AODP à la recherche de flips.
      </p>
    );
  }

  if (flips.length === 0) {
    return (
      <p className="text-sm text-navy-400">
        Aucun flip public rentable trouvé parmi les objets sélectionnés. Essayez d&apos;ajouter d&apos;autres
        objets, ou d&apos;augmenter l&apos;âge max des prix.
      </p>
    );
  }

  const headers: { key: SortKey | null; label: string; align: string; width: string; title?: string }[] = [
    { key: null, label: "Objet", align: "text-left", width: "w-64" },
    { key: null, label: "Qualité", align: "text-center", width: "w-28" },
    { key: null, label: "Route", align: "text-left", width: "w-56" },
    { key: "buyPrice", label: "Achat", align: "text-right", width: "w-24" },
    { key: null, label: "Vente (net)", align: "text-right", width: "w-24" },
    { key: "profitPerUnit", label: "Profit/Unité", align: "text-right", width: "w-24" },
    { key: "roi", label: "ROI", align: "text-right", width: "w-20" },
    {
      key: "avgAmount",
      label: "Moy/Jour",
      align: "text-right",
      width: "w-24",
      title: "Quantité moyenne échangée par jour récemment — un signal de liquidité approximatif, pas une taille d'ordre garantie",
    },
    { key: null, label: "Âge achat", align: "text-right", width: "w-24" },
    { key: null, label: "Âge vente", align: "text-right", width: "w-24" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-navy-700">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
            {headers.map((h) => (
              <th
                key={h.label}
                title={h.title}
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
          {sorted.map((flip) => (
            <FlipRow key={`${flip.itemId}|${flip.qualityLevel}|${flip.sourceCity}|${flip.destCity}`} flip={flip} item={byId.get(flip.itemId)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
