"use client";

import { useMemo, useState } from "react";
import type { CatalogItem } from "../market-prices/types";
import { QUALITY_LABELS } from "../market-prices/types";
import type { FlipOpportunity } from "./calc";

type SortKey = "totalProfit" | "profitPerUnit" | "roi" | "buyPrice" | "quantity";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function ageMinutes(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 60_000);
}

function ageLabel(dateStr: string): string {
  const minutes = ageMinutes(dateStr);
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

// Item type ids for enchant>0 resources already carry their own "_LEVELN"
// infix as a distinct in-game item (not a separate item-catalog.json row —
// see build-item-catalog.mjs / market-prices/types.ts's itemId()), so a
// direct catalog lookup by itemTypeId misses those; strip the infix and
// retry against the base entry. Unverified against live scanned data — see
// PROJECT_STATUS.md follow-up.
function resolveItem(itemTypeId: string, catalog: CatalogItem[]): CatalogItem | null {
  const direct = catalog.find((i) => i.uniqueName === itemTypeId);
  if (direct) return direct;
  const stripped = itemTypeId.replace(/_LEVEL\d+$/, "");
  if (stripped === itemTypeId) return null;
  return catalog.find((i) => i.uniqueName === stripped) ?? null;
}

function iconId(itemTypeId: string, enchant: number): string {
  return enchant > 0 ? `${itemTypeId}@${enchant}` : itemTypeId;
}

function locationLabel(city: string | null, locationId: string): string {
  return city ?? `Unknown (${locationId})`;
}

function FlipRow({
  flip,
  catalog,
  expanded,
  onToggle,
}: {
  flip: FlipOpportunity;
  catalog: CatalogItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const item = resolveItem(flip.itemTypeId, catalog);
  const name = item?.name ?? flip.itemTypeId;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer divide-x divide-navy-700 border-b border-navy-800 hover:bg-navy-800/50"
      >
        <td className="w-64 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://render.albiononline.com/v1/item/${iconId(flip.itemTypeId, flip.enchantmentLevel)}.png`}
              alt=""
              className="h-7 w-7 shrink-0"
            />
            <span className="truncate text-sm text-navy-100">
              {name}
              {flip.enchantmentLevel > 0 ? `.${flip.enchantmentLevel}` : ""}
            </span>
          </div>
        </td>
        <td className="w-28 px-2 py-1.5 text-center text-xs text-navy-300">
          {item?.hasQuality ? QUALITY_LABELS[flip.qualityLevel] : "-"}
        </td>
        <td className="w-56 px-2 py-1.5 text-xs text-navy-300">
          <div className="flex items-center gap-1 truncate">
            <span>{locationLabel(flip.sourceCity, flip.sourceLocationId)}</span>
            <span className="text-navy-500">→</span>
            <span className={flip.isBlackMarketFlip ? "font-semibold text-red-300" : ""}>
              {locationLabel(flip.destCity, flip.destLocationId)}
            </span>
          </div>
        </td>
        <td className="w-24 px-2 py-1.5 text-right text-sm text-navy-300">{money(flip.buyPrice)}</td>
        <td className="w-24 px-2 py-1.5 text-right text-sm text-navy-300">{money(flip.netSellPrice)}</td>
        <td className="w-16 px-2 py-1.5 text-right text-sm text-navy-300">{flip.quantity}</td>
        <td
          className={`w-24 px-2 py-1.5 text-right text-sm font-semibold ${
            flip.profitPerUnit >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {money(flip.profitPerUnit)}
        </td>
        <td
          className={`w-28 px-2 py-1.5 text-right text-sm font-semibold ${
            flip.totalProfit >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {money(flip.totalProfit)}
        </td>
        <td className="w-20 px-2 py-1.5 text-right text-sm text-navy-300">{(flip.roi * 100).toFixed(1)}%</td>
      </tr>
      {expanded && (
        <tr className="border-b border-navy-800 bg-navy-900/60">
          <td colSpan={9} className="px-4 py-3">
            <div className="flex flex-col gap-1 text-xs text-navy-400">
              <p>Item type id: {flip.itemTypeId}</p>
              <p>
                Buy: order {flip.buyOrderId} at {locationLabel(flip.sourceCity, flip.sourceLocationId)},{" "}
                {flip.buyAmount} available, scanned {ageLabel(flip.buyUpdatedAt)} ago
              </p>
              <p>
                Sell: order {flip.sellOrderId} at {locationLabel(flip.destCity, flip.destLocationId)},{" "}
                {flip.sellAmount} available, scanned {ageLabel(flip.sellUpdatedAt)} ago
              </p>
              <p>
                Sell price {money(flip.sellPrice)} net of sales tax → {money(flip.netSellPrice)} per unit
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function FlipResultsTable({
  flips,
  catalog,
}: {
  flips: FlipOpportunity[];
  catalog: CatalogItem[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("totalProfit");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const sorted = useMemo(() => {
    const copy = [...flips];
    copy.sort((a, b) => {
      const cmp = a[sortKey] - b[sortKey];
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

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (flips.length === 0) {
    return (
      <p className="text-sm text-navy-400">
        No profitable flips found in your scanned data. Scan a city market and the Black Market in-game
        with the desktop client, then Refresh Orders above.
      </p>
    );
  }

  const headers: { key: SortKey | null; label: string; align: string; width: string }[] = [
    { key: null, label: "Item", align: "text-left", width: "w-64" },
    { key: null, label: "Quality", align: "text-center", width: "w-28" },
    { key: null, label: "Route", align: "text-left", width: "w-56" },
    { key: "buyPrice", label: "Buy", align: "text-right", width: "w-24" },
    { key: null, label: "Sell (net)", align: "text-right", width: "w-24" },
    { key: "quantity", label: "Qty", align: "text-right", width: "w-16" },
    { key: "profitPerUnit", label: "Profit/Unit", align: "text-right", width: "w-24" },
    { key: "totalProfit", label: "Total Profit", align: "text-right", width: "w-28" },
    { key: "roi", label: "ROI", align: "text-right", width: "w-20" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-navy-700">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="divide-x divide-navy-700 bg-navy-850 text-navy-300">
            {headers.map((h) => (
              <th
                key={h.label}
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
          {sorted.map((flip, i) => (
            <FlipRow
              key={`${flip.itemTypeId}|${flip.qualityLevel}|${flip.enchantmentLevel}|${flip.buyOrderId}|${flip.sellOrderId}`}
              flip={flip}
              catalog={catalog}
              expanded={expanded.has(i)}
              onToggle={() => toggleExpanded(i)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
