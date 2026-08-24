"use client";

import { useMemo, useState } from "react";
import type { CatalogItem } from "../market-prices/types";
import { QUALITY_LABELS, QUALITY_LEVELS } from "../market-prices/types";
import CategoryTree from "../market-prices/CategoryTree";
import type { CraftItem } from "./calc";

const MAX_SEARCH_RESULTS = 30;

function iconUrl(uniqueName: string, enchant: number): string {
  const id = enchant === 0 ? uniqueName : `${uniqueName}@${enchant}`;
  return `https://render.albiononline.com/v1/item/${id}.png`;
}

export default function ItemRecipePicker({
  catalog,
  craftItems,
  selectedUniqueName,
  selectedEnchant,
  outputQuality,
  onSelectItem,
  onSelectEnchant,
  onSelectQuality,
}: {
  catalog: CatalogItem[];
  craftItems: CraftItem[];
  selectedUniqueName: string | null;
  selectedEnchant: number;
  outputQuality: number;
  onSelectItem: (uniqueName: string) => void;
  onSelectEnchant: (enchant: number) => void;
  onSelectQuality: (quality: number) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const craftItemsByName = useMemo(() => {
    const map = new Map<string, CraftItem>();
    for (const item of craftItems) map.set(item.uniqueName, item);
    return map;
  }, [craftItems]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (!craftItemsByName.has(item.uniqueName)) return false;
      if (categoryFilter.size > 0 && !categoryFilter.has(item.uniqueName)) return false;
      return true;
    });
  }, [catalog, craftItemsByName, categoryFilter]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const needle = search.trim().toLowerCase();
    return filteredCatalog.filter((i) => i.name.toLowerCase().includes(needle)).slice(0, MAX_SEARCH_RESULTS);
  }, [filteredCatalog, search]);

  const selectedCatalogItem = selectedUniqueName
    ? (catalog.find((i) => i.uniqueName === selectedUniqueName) ?? null)
    : null;
  const selectedCraftItem = selectedUniqueName ? (craftItemsByName.get(selectedUniqueName) ?? null) : null;
  const availableEnchants = selectedCraftItem?.recipes.map((r) => r.enchant).sort((a, b) => a - b) ?? [];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-navy-700 bg-navy-850 p-4">
      <h2 className="text-sm font-semibold text-navy-400 uppercase tracking-wide">Item &amp; Recipe</h2>

      <div className="flex flex-wrap items-center gap-2">
        <CategoryTree catalog={catalog.filter((i) => craftItemsByName.has(i.uniqueName))} selected={categoryFilter} onChange={setCategoryFilter} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="min-w-64 rounded border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-navy-100 placeholder:text-navy-500"
        />
      </div>

      {searchResults.length > 0 && (
        <ul className="max-h-64 divide-y divide-navy-700 overflow-y-auto rounded border border-navy-600">
          {searchResults.map((item) => (
            <li key={item.uniqueName}>
              <button
                type="button"
                onClick={() => {
                  onSelectItem(item.uniqueName);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy-100 hover:bg-navy-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl(item.uniqueName, 0)} alt="" className="h-8 w-8" />
                <span>
                  {item.name} [T{item.tier}]
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedCatalogItem && selectedCraftItem && (
        <div className="flex flex-wrap items-center gap-4 rounded border border-navy-600 bg-navy-900 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl(selectedUniqueName!, selectedEnchant)} alt="" className="h-12 w-12" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-navy-100">
              {selectedCatalogItem.name} [T{selectedCatalogItem.tier}.{selectedEnchant}]
            </span>
            {selectedCraftItem.specAchievementId && (
              <span className="text-xs text-navy-400">Spec: {selectedCraftItem.specAchievementId}</span>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Enchant
            <select
              value={selectedEnchant}
              onChange={(e) => onSelectEnchant(parseInt(e.target.value, 10))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {availableEnchants.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Sell Quality
            <select
              value={outputQuality}
              onChange={(e) => onSelectQuality(parseInt(e.target.value, 10))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {QUALITY_LEVELS.map((q) => (
                <option key={q} value={q}>
                  {QUALITY_LABELS[q]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
