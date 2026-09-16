"use client";

import { useEffect, useRef, useState } from "react";

// Generic compact checkbox-dropdown, matching CategoryTree's button styling
// (gold when active, navy otherwise) and click-outside-to-close behavior —
// used for Tiers and Enchantments in ItemPicker so they read as one
// consistent filter row instead of always-visible checkbox rows, mirroring
// AFM's own Price Checker "Select Items" controls (albionfreemarket.com/pricecheck).
export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: number; label: string }[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleValue(value: number) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonLabel = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-3 py-1.5 text-sm ${
          selected.length > 0
            ? "border-gold-600 bg-gold-500/10 text-gold-400"
            : "border-navy-600 bg-transparent text-navy-200 hover:bg-navy-700"
        }`}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 flex w-40 flex-col rounded border border-navy-600 bg-navy-800 shadow-lg">
          <button
            type="button"
            className="border-b border-navy-700 px-2 py-1.5 text-left text-xs text-navy-300 hover:text-navy-100"
            onClick={() => onChange([])}
          >
            Effacer la sélection
          </button>
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-navy-100 hover:bg-navy-700"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
