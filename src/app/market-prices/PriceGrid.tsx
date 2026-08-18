"use client";

import { useState } from "react";
import { itemId, CITY_ROW_STYLE, QUALITY_LABELS, QUALITY_LEVELS } from "./types";
import type { PriceCheckerConfig, PriceRow, SelectedItem } from "./types";
import PriceHistoryChart from "./PriceHistoryChart";

const CHART_DAYS = 30;

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

function Cell({
  row,
  config,
  textColor,
  active,
  onSelect,
}: {
  row: PriceRow | undefined;
  config: PriceCheckerConfig;
  textColor: string;
  active: boolean;
  onSelect: () => void;
}) {
  if (!row) {
    return (
      <td
        onClick={onSelect}
        title="Click to view price history"
        className={`min-w-[68px] cursor-pointer px-1.5 py-1 text-center text-sm hover:brightness-110 ${active ? "ring-1 ring-inset ring-white/60" : ""}`}
        style={{ color: `${textColor}80` }}
      >
        -
      </td>
    );
  }

  const headline = config.priceType === "sell" ? row.sellPriceMin : row.buyPriceMax;
  const headlineDate = config.priceType === "sell" ? row.sellPriceMinDate : row.buyPriceMaxDate;
  const badge = headline > 0 ? ageBadge(headlineDate) : null;

  return (
    <td
      onClick={onSelect}
      title="Click to view price history"
      className={`min-w-[68px] cursor-pointer px-1.5 py-1 hover:brightness-110 ${active ? "ring-1 ring-inset ring-white/60" : ""}`}
    >
      <div className="flex items-center justify-center gap-1">
        <span className="text-sm font-semibold" style={{ color: textColor }}>
          {headline > 0 ? headline.toLocaleString() : "-"}
        </span>
        {badge && (
          <span
            title={badge.title}
            className={`shrink-0 rounded px-0.5 text-[10px] leading-tight text-white ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      {config.showAverages && (
        <div className="flex justify-between text-[11px]" style={{ color: `${textColor}c0` }}>
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

function ItemCard({
  item,
  prices,
  config,
}: {
  item: SelectedItem;
  prices: PriceRow[];
  config: PriceCheckerConfig;
}) {
  const id = itemId(item);
  const rowsForItem = prices.filter((p) => p.itemId === id);
  // Resources, farmables, consumables etc. never vary by quality — only
  // equipment/mounts do (see build-item-catalog.mjs's hasQuality flag).
  const qualityLevels = item.hasQuality ? QUALITY_LEVELS : [1];

  const [activeChart, setActiveChart] = useState<{ city: string; quality: number } | null>(null);

  return (
    <div
      className={`flex-shrink-0 rounded-lg border border-navy-700 bg-navy-850 p-2 ${activeChart ? "min-w-[420px]" : ""}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://render.albiononline.com/v1/item/${id}.png`} alt="" className="h-8 w-8" />
        <div>
          <p className="text-sm font-semibold text-navy-100">
            {item.name} [{item.tier}.{item.enchant}]
          </p>
          <p className="text-xs text-navy-400">
            Tier {item.tier} Enchantment {item.enchant}
          </p>
        </div>
      </div>

      <table className="border-separate border-spacing-y-0.5">
        <thead>
          <tr className="divide-x divide-navy-700 text-navy-300">
            {qualityLevels.map((quality) => (
              <th key={quality} className="min-w-[68px] px-1.5 text-center text-xs font-medium">
                {item.hasQuality ? QUALITY_LABELS[quality] : "Price"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.cities.map((city) => {
            const style = CITY_ROW_STYLE[city] ?? { bg: "#232e4a", text: "#dde3f2" };
            return (
              <tr
                key={city}
                title={city}
                className="divide-x divide-black/25"
                style={{ backgroundColor: style.bg }}
              >
                {qualityLevels.map((quality) => {
                  const row = rowsForItem.find((p) => p.city === city && p.quality === quality);
                  const isActive = activeChart?.city === city && activeChart?.quality === quality;
                  return (
                    <Cell
                      key={quality}
                      row={row}
                      config={config}
                      textColor={style.text}
                      active={isActive}
                      onSelect={() =>
                        setActiveChart(isActive ? null : { city, quality })
                      }
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {activeChart && (
        <PriceHistoryChart
          key={`${activeChart.city}|${activeChart.quality}`}
          item={item}
          city={activeChart.city}
          quality={activeChart.quality}
          hasQuality={item.hasQuality}
          region={config.region}
          days={CHART_DAYS}
          onClose={() => setActiveChart(null)}
        />
      )}
    </div>
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  if (selectedItems.length === 0) {
    return <p className="text-sm text-navy-400">Select items above, then hit Refresh.</p>;
  }

  // Group enchant variants of the same tiered item (same uniqueName) under one
  // collapsible header, matching AFM's side-by-side card layout.
  const groups = new Map<string, SelectedItem[]>();
  for (const item of selectedItems) {
    if (!groups.has(item.uniqueName)) groups.set(item.uniqueName, []);
    groups.get(item.uniqueName)!.push(item);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {loading && <p className="text-sm text-navy-300">Loading prices…</p>}
      {[...groups.entries()].map(([uniqueName, items]) => {
        const sorted = [...items].sort((a, b) => a.enchant - b.enchant);
        const isCollapsed = collapsedGroups.has(uniqueName);

        return (
          <div key={uniqueName}>
            <button
              type="button"
              onClick={() => toggleGroup(uniqueName)}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold-400 hover:text-gold-300"
            >
              <span className="inline-block w-4 text-center">{isCollapsed ? "+" : "−"}</span>
              {sorted[0].name} ({sorted.length})
            </button>
            {!isCollapsed && (
              <div className="flex flex-wrap gap-3">
                {sorted.map((item) => (
                  <ItemCard key={itemId(item)} item={item} prices={prices} config={config} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
