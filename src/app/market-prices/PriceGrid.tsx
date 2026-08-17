"use client";

import { itemId, QUALITY_LABELS, QUALITY_LEVELS } from "./types";
import type { PriceCheckerConfig, PriceRow, SelectedItem } from "./types";

function ageBadge(dateStr: string): { label: string; title: string; className: string } | null {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return null;

  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 0) return null;

  const label = hours < 10 ? hours.toFixed(1) : Math.round(hours).toString();
  const title = `${label} hour${hours >= 1.05 || hours < 0.95 ? "s" : ""} old`;

  if (hours < 2) return { label, title, className: "bg-green-700" };
  if (hours < 24) return { label, title, className: "bg-amber-700" };
  return { label, title, className: "bg-red-800" };
}

function Cell({ row, config }: { row: PriceRow | undefined; config: PriceCheckerConfig }) {
  if (!row) {
    return <td className="border border-neutral-800 px-2 py-1 text-center text-neutral-600">-</td>;
  }

  const headline = config.priceType === "sell" ? row.sellPriceMin : row.buyPriceMax;
  const headlineDate = config.priceType === "sell" ? row.sellPriceMinDate : row.buyPriceMaxDate;
  const badge = headline > 0 ? ageBadge(headlineDate) : null;

  return (
    <td className="relative border border-neutral-800 px-2 py-1">
      {badge && (
        <span
          title={badge.title}
          className={`absolute top-0 right-0 rounded-bl px-1 text-[10px] text-white ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      <div className="text-center font-semibold">{headline > 0 ? headline.toLocaleString() : "-"}</div>
      {config.showAverages && (
        <div className="flex justify-between px-1 text-xs text-neutral-400">
          <span title="Average price">
            {row.avgPrice != null ? row.avgPrice.toLocaleString() : "-"}
          </span>
          <span title="Average amount traded">
            {row.avgAmount != null ? row.avgAmount.toLocaleString() : "-"}
          </span>
        </div>
      )}
    </td>
  );
}

export default function PriceGrid({
  selectedItems,
  prices,
  config,
  loading,
}: {
  selectedItems: SelectedItem[];
  prices: PriceRow[];
  config: PriceCheckerConfig;
  loading: boolean;
}) {
  if (selectedItems.length === 0) {
    return <p className="text-sm text-neutral-500">Select items above, then hit Refresh.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {loading && <p className="text-sm text-neutral-400">Loading prices…</p>}
      {selectedItems.map((item) => {
        const id = itemId(item);
        const rowsForItem = prices.filter((p) => p.itemId === id);
        // Resources, farmables, consumables etc. never vary by quality — only
        // equipment/mounts do (see build-item-catalog.mjs's hasQuality flag).
        const qualityLevels = item.hasQuality ? QUALITY_LEVELS : [1];

        return (
          <div key={id} className="rounded border border-neutral-800 p-3">
            <div className="mb-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://render.albiononline.com/v1/item/${id}.png`}
                alt=""
                className="h-10 w-10"
              />
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-neutral-400">
                  Tier {item.tier} Enchantment {item.enchant}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-neutral-800 px-2 py-1 text-left">City</th>
                    {qualityLevels.map((quality) => (
                      <th key={quality} className="border border-neutral-800 px-2 py-1">
                        {item.hasQuality ? QUALITY_LABELS[quality] : "Price"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.cities.map((city) => (
                    <tr key={city}>
                      <td className="border border-neutral-800 px-2 py-1 whitespace-nowrap">
                        {city}
                      </td>
                      {qualityLevels.map((quality) => {
                        const row = rowsForItem.find(
                          (p) => p.city === city && p.quality === quality,
                        );
                        return <Cell key={quality} row={row} config={config} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
