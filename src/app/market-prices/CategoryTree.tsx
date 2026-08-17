"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCategoryTree, lineNameOf } from "./categoryTaxonomy";
import type { CatalogItem } from "./types";

function selectedCount(items: CatalogItem[], selected: Set<string>): number {
  return items.filter((item) => selected.has(item.uniqueName)).length;
}

type Line = { label: string; items: CatalogItem[] };

function groupByLine(items: CatalogItem[]): Line[] {
  const byLine = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const label = lineNameOf(item);
    if (!byLine.has(label)) byLine.set(label, []);
    byLine.get(label)!.push(item);
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
    <div className="flex gap-3 border-b border-neutral-800 px-2 py-1.5 text-xs">
      <button
        type="button"
        className="text-neutral-300 hover:text-neutral-100"
        onClick={() => {
          const next = new Set(selected);
          for (const item of items) next.add(item.uniqueName);
          onChange(next);
        }}
      >
        Select All
      </button>
      <button
        type="button"
        className="text-neutral-300 hover:text-neutral-100"
        onClick={() => {
          const next = new Set(selected);
          for (const item of items) next.delete(item.uniqueName);
          onChange(next);
        }}
      >
        Remove All
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
  const lines = subNode ? groupByLine(subNode.items) : [];

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
    selected.size === 0 ? "Shop Categories (All)" : `Shop Categories (${selected.size}/${catalog.length})`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-3 py-1.5 text-sm ${
          selected.size > 0
            ? "border-amber-600 bg-amber-950/40 text-amber-300"
            : "border-neutral-700 bg-transparent hover:bg-neutral-800"
        }`}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 flex rounded border border-neutral-700 bg-neutral-900 shadow-lg">
          <div className="flex w-56 flex-col border-r border-neutral-800">
            <button
              type="button"
              className="border-b border-neutral-800 px-2 py-1.5 text-left text-xs text-neutral-300 hover:text-neutral-100"
              onClick={() => onChange(new Set())}
            >
              Clear Selection
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
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm ${
                    openTop === label ? "bg-neutral-800" : "hover:bg-neutral-800"
                  }`}
                >
                  <span>
                    {label} ({selectedCount(node.items, selected)}/{node.items.length})
                  </span>
                  <span className="text-neutral-500">›</span>
                </button>
              ))}
            </div>
          </div>

          {topNode && (
            <div className="flex w-56 flex-col border-r border-neutral-800">
              <SelectAllRow items={topNode.items} selected={selected} onChange={onChange} />
              <div className="max-h-80 overflow-y-auto">
                {[...topNode.children.entries()].map(([label, node]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setOpenSub(label)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm ${
                      openSub === label ? "bg-neutral-800" : "hover:bg-neutral-800"
                    }`}
                  >
                    <span>
                      {label} ({selectedCount(node.items, selected)}/{node.items.length})
                    </span>
                    <span className="text-neutral-500">›</span>
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
                      className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-neutral-800"
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
