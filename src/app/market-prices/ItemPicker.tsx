"use client";

import { useMemo, useState } from "react";
import type { CatalogItem, SelectedItem } from "./types";
import { itemId } from "./types";
import CategoryTree from "./CategoryTree";

const MAX_SELECTED_ITEMS = 100;
const MAX_SEARCH_RESULTS = 30;

function toggle<T>(set: T[], value: T): T[] {
  return set.includes(value) ? set.filter((v) => v !== value) : [...set, value];
}

type Variant = { catalogItem: CatalogItem; enchant: number };

function variantToSelectedItem(v: Variant): SelectedItem {
  return {
    uniqueName: v.catalogItem.uniqueName,
    name: v.catalogItem.name,
    tier: v.catalogItem.tier,
    enchant: v.enchant,
    enchantSuffix: v.catalogItem.enchantSuffix,
    hasQuality: v.catalogItem.hasQuality,
  };
}

function variantIconUrl(v: Variant): string {
  return `https://render.albiononline.com/v1/item/${itemId(variantToSelectedItem(v))}.png`;
}

export default function ItemPicker({
  catalog,
  selectedItems,
  onChange,
}: {
  catalog: CatalogItem[];
  selectedItems: SelectedItem[];
  onChange: (items: SelectedItem[]) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<number[]>([]);
  const [enchantFilter, setEnchantFilter] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (categoryFilter.size > 0 && !categoryFilter.has(item.uniqueName)) return false;
      if (tierFilter.length > 0 && !tierFilter.includes(item.tier)) return false;
      return true;
    });
  }, [catalog, categoryFilter, tierFilter]);

  const filteredVariants = useMemo(() => {
    const variants: Variant[] = [];
    for (const catalogItem of filteredCatalog) {
      for (let enchant = 0; enchant <= catalogItem.maxEnchant; enchant++) {
        if (enchantFilter.length > 0 && !enchantFilter.includes(enchant)) continue;
        variants.push({ catalogItem, enchant });
      }
    }
    return variants;
  }, [filteredCatalog, enchantFilter]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const needle = search.trim().toLowerCase();
    return filteredVariants
      .filter((v) => v.catalogItem.name.toLowerCase().includes(needle))
      .slice(0, MAX_SEARCH_RESULTS);
  }, [filteredVariants, search]);

  const selectedIds = useMemo(() => new Set(selectedItems.map(itemId)), [selectedItems]);

  function addVariant(v: Variant) {
    const selected = variantToSelectedItem(v);
    if (selectedIds.has(itemId(selected))) return;
    if (selectedItems.length >= MAX_SELECTED_ITEMS) return;
    onChange([...selectedItems, selected]);
  }

  function removeItem(id: string) {
    onChange(selectedItems.filter((item) => itemId(item) !== id));
  }

  function addFiltered() {
    const toAdd: SelectedItem[] = [];
    for (const v of filteredVariants) {
      const candidate = variantToSelectedItem(v);
      const id = itemId(candidate);
      if (selectedIds.has(id) || toAdd.some((t) => itemId(t) === id)) continue;
      toAdd.push(candidate);
      if (selectedItems.length + toAdd.length >= MAX_SELECTED_ITEMS) break;
    }
    onChange([...selectedItems, ...toAdd]);
  }

  function clearFilters() {
    setCategoryFilter(new Set());
    setTierFilter([]);
    setEnchantFilter([]);
    setSearch("");
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-navy-700 bg-navy-850 p-4">
      <h2 className="text-sm font-semibold text-navy-400 uppercase tracking-wide">
        Select Items
      </h2>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <span className="mb-1 text-xs text-navy-400">Shop Categories</span>
          <CategoryTree catalog={catalog} selected={categoryFilter} onChange={setCategoryFilter} />
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs text-navy-400">Tiers</legend>
          <div className="flex max-w-56 flex-wrap gap-2 text-navy-200">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((tier) => (
              <label key={tier} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={tierFilter.includes(tier)}
                  onChange={() => setTierFilter(toggle(tierFilter, tier))}
                />
                T{tier}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs text-navy-400">Enchantments</legend>
          <div className="flex max-w-40 flex-wrap gap-2 text-navy-200">
            {[0, 1, 2, 3, 4].map((enchant) => (
              <label key={enchant} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={enchantFilter.includes(enchant)}
                  onChange={() => setEnchantFilter(toggle(enchantFilter, enchant))}
                />
                {enchant}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="min-w-64 rounded border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-navy-100 placeholder:text-navy-500"
        />
        <button
          type="button"
          onClick={addFiltered}
          disabled={filteredVariants.length === 0}
          className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
        >
          Add Filtered ({filteredVariants.length})
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
        >
          Clear Filters
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selectedItems.length === 0}
          className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
        >
          Clear Selected Items
        </button>
      </div>

      {searchResults.length > 0 && (
        <ul className="max-h-64 divide-y divide-navy-700 overflow-y-auto rounded border border-navy-600">
          {searchResults.map((v) => {
            const id = itemId(variantToSelectedItem(v));
            const alreadySelected = selectedIds.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => addVariant(v)}
                  disabled={alreadySelected}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy-100 hover:bg-navy-700 disabled:opacity-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={variantIconUrl(v)} alt="" className="h-8 w-8" />
                  <span>
                    {v.catalogItem.name} [{v.catalogItem.tier}.{v.enchant}]
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <p className="mb-2 text-sm text-navy-400">
          Selected Items: {selectedItems.length}/{MAX_SELECTED_ITEMS}
        </p>
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => {
            const id = itemId(item);
            return (
              <span
                key={id}
                className="flex items-center gap-2 rounded-full border border-navy-600 bg-navy-800 py-1 pl-1 pr-2 text-sm text-navy-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://render.albiononline.com/v1/item/${id}.png`}
                  alt=""
                  className="h-6 w-6"
                />
                {item.name} [{item.tier}.{item.enchant}]
                <button
                  type="button"
                  onClick={() => removeItem(id)}
                  className="text-navy-400 hover:text-navy-100"
                  aria-label={`Remove ${item.name}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
