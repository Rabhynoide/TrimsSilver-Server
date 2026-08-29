"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCategoryTree, hasTierRankPrefix, lineNameOf } from "./categoryTaxonomy";
import type { CatalogItem } from "./types";

function selectedCount(items: CatalogItem[], selected: Set<string>): number {
  return items.filter((item) => selected.has(item.uniqueName)).length;
}

type Line = { label: string; items: CatalogItem[] };

// Gear (weapons, armor, artifacts, ...) names carry a tier-rank prefix
// ("Adept's Broadsword"), so grouping by the stripped name collapses tiers of
// the same weapon/armor line together. Plain items (resources, farmables, ...)
// don't have that prefix — but when a subcategory's plain items each occupy a
// distinct tier (one item per tier, e.g. Ore: Copper/Tin/Iron/.../Adamantium),
// they're really the same "type" across tiers too, just named per-tier instead
// of per-rank, so they're merged into one line named after the subcategory.
// Subcategories with several plain items sharing a tier (e.g. Furniture, where
// dozens of distinct decorations all sit at T1) are left as individual lines —
// there's no single "type" to collapse them into.
function groupByLine(items: CatalogItem[], subCategoryLabel: string): Line[] {
  const prefixed = items.filter(hasTierRankPrefix);
  const plain = items.filter((item) => !hasTierRankPrefix(item));

  const byLine = new Map<string, CatalogItem[]>();
  for (const item of prefixed) {
    const label = lineNameOf(item);
    if (!byLine.has(label)) byLine.set(label, []);
    byLine.get(label)!.push(item);
  }

  const isTierProgression = plain.length > 1 && new Set(plain.map((i) => i.tier)).size === plain.length;
  if (isTierProgression) {
    byLine.set(subCategoryLabel, plain);
  } else {
    for (const item of plain) {
      byLine.set(item.name, [item]);
    }
  }

  return [...byLine.entries()]
    .map(([label, lineItems]) => ({ label, items: lineItems }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function SelectAllRow({
  items,
  selected,
  onChange,
}: {
  items: CatalogItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div className="flex gap-3 border-b border-navy-700 px-2 py-1.5 text-xs">
      <button
        type="button"
        className="text-navy-300 hover:text-navy-100"
        onClick={() => {
          const next = new Set(selected);
          for (const item of items) next.add(item.uniqueName);
          onChange(next);
        }}
      >
        Tout sélectionner
      </button>
      <button
        type="button"
        className="text-navy-300 hover:text-navy-100"
        onClick={() => {
          const next = new Set(selected);
          for (const item of items) next.delete(item.uniqueName);
          onChange(next);
        }}
      >
        Tout retirer
      </button>
    </div>
  );
}

export default function CategoryTree({
  catalog,
  selected,
  onChange,
}: {
  catalog: CatalogItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openTop, setOpenTop] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildCategoryTree(catalog), [catalog]);
  const topNode = openTop ? tree.get(openTop) : undefined;
  const subNode = topNode && openSub ? topNode.children.get(openSub) : undefined;
  const lines = subNode ? groupByLine(subNode.items, subNode.label) : [];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const buttonLabel =
    selected.size === 0
      ? "Catégories de la boutique (Toutes)"
      : `Catégories de la boutique (${selected.size}/${catalog.length})`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-3 py-1.5 text-sm ${
          selected.size > 0
            ? "border-gold-600 bg-gold-500/10 text-gold-400"
            : "border-navy-600 bg-transparent text-navy-200 hover:bg-navy-700"
        }`}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 flex rounded border border-navy-600 bg-navy-800 shadow-lg">
          <div className="flex w-56 flex-col border-r border-navy-700">
            <button
              type="button"
              className="border-b border-navy-700 px-2 py-1.5 text-left text-xs text-navy-300 hover:text-navy-100"
              onClick={() => onChange(new Set())}
            >
              Effacer la sélection
            </button>
            <div className="max-h-80 overflow-y-auto">
              {[...tree.entries()].map(([label, node]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setOpenTop(label);
                    setOpenSub(null);
                  }}
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm text-navy-100 ${
                    openTop === label ? "bg-navy-700" : "hover:bg-navy-700"
                  }`}
                >
                  <span>
                    {label} ({selectedCount(node.items, selected)}/{node.items.length})
                  </span>
                  <span className="text-navy-400">›</span>
                </button>
              ))}
            </div>
          </div>

          {topNode && (
            <div className="flex w-56 flex-col border-r border-navy-700">
              <SelectAllRow items={topNode.items} selected={selected} onChange={onChange} />
              <div className="max-h-80 overflow-y-auto">
                {[...topNode.children.entries()].map(([label, node]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setOpenSub(label)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm text-navy-100 ${
                      openSub === label ? "bg-navy-700" : "hover:bg-navy-700"
                    }`}
                  >
                    <span>
                      {label} ({selectedCount(node.items, selected)}/{node.items.length})
                    </span>
                    <span className="text-navy-400">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {subNode && (
            <div className="flex w-56 flex-col">
              <SelectAllRow items={subNode.items} selected={selected} onChange={onChange} />
              <div className="max-h-80 overflow-y-auto">
                {lines.map((line) => {
                  const lineSelected = line.items.every((item) => selected.has(item.uniqueName));
                  return (
                    <label
                      key={line.label}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-navy-100 hover:bg-navy-700"
                    >
                      <input
                        type="checkbox"
                        checked={lineSelected}
                        onChange={() => {
                          const next = new Set(selected);
                          for (const item of line.items) {
                            if (lineSelected) {
                              next.delete(item.uniqueName);
                            } else {
                              next.add(item.uniqueName);
                            }
                          }
                          onChange(next);
                        }}
                      />
                      {line.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
