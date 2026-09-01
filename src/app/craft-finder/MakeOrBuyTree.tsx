"use client";

import { useMemo, useState } from "react";
import type { CraftItem, CraftRecipe } from "../crafting/calc";
import {
  evaluateFinalItem,
  type EvalContext,
  type OutputPriceLookup,
  type ResourceChildLine,
  type ResourceTreeNode,
} from "./calc";
import type { PriceMode } from "./types";

// Same threshold as RankingTable's own STALE_PRICE_HOURS (kept as a local
// duplicate rather than a shared import — this file and RankingTable.tsx
// don't otherwise share a module). AODP prices are crowdsourced: a listing
// only refreshes when someone's own client happens to visit that city's
// market, so a cheap outlier order can sit reported as the current price
// for hours after it's actually been bought out — flagging the age here
// warns the user to double-check in-game before relying on a buy price this
// old, exactly the gap that prompted this (a 60-silver egg listing that had
// already sold out to 148 by the time the user checked in-game).
const STALE_PRICE_HOURS = 12;

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

function ageHours(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? null : (Date.now() - t) / (1000 * 60 * 60);
}

function ageLabel(dateStr: string | null): string {
  const hours = ageHours(dateStr);
  if (hours == null) return "inconnue";
  return hours < 1 ? "< 1h" : `${Math.round(hours)}h`;
}

function ChoiceBadge({ chosen }: { chosen: ResourceTreeNode["chosen"] }) {
  if (chosen === "buy")
    return <span className="rounded bg-navy-600 px-1.5 py-0.5 text-[10px] font-semibold text-navy-100">ACHETER</span>;
  if (chosen === "craft")
    return (
      <span className="rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold text-navy-950">
        RAFFINER/CRAFT
      </span>
    );
  return <span className="rounded bg-red-900 px-1.5 py-0.5 text-[10px] font-semibold text-red-100">INDISPONIBLE</span>;
}

function ResourceNodeRow({
  line,
  depth,
  expanded,
  onToggle,
  nameOf,
  manualPrices,
  onManualPriceChange,
  priceMode,
}: {
  line: ResourceChildLine;
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  nameOf: (uniqueName: string) => string;
  manualPrices: Record<string, number>;
  onManualPriceChange: (marketId: string, value: number) => void;
  priceMode: PriceMode;
}) {
  const node = line.node;
  const isOpen = expanded.has(node.uniqueName);
  const canExpand = node.chosen === "craft" && node.bestCraftOption != null;
  const gap =
    node.buyPrice != null && node.bestCraftOption != null
      ? node.buyPrice - node.bestCraftOption.totalCost
      : null;
  const buyHours = ageHours(node.buyPriceAge);
  const buyIsStale = buyHours != null && buyHours >= STALE_PRICE_HOURS;

  return (
    <div className="flex flex-col" style={{ marginLeft: depth * 20 }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-800 py-1.5 text-sm">
        <button
          type="button"
          onClick={() => canExpand && onToggle(node.uniqueName)}
          className={`w-4 shrink-0 text-navy-400 ${canExpand ? "cursor-pointer hover:text-navy-100" : "opacity-30"}`}
          disabled={!canExpand}
        >
          {canExpand ? (isOpen ? "▾" : "▸") : "·"}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://render.albiononline.com/v1/item/${node.uniqueName}.png`} alt="" className="h-6 w-6 shrink-0" />
        <span className="min-w-0 truncate text-navy-100">{nameOf(node.uniqueName)}</span>
        <span className="shrink-0 text-xs text-navy-400">
          × {line.count} (net {line.netUnits.toFixed(2)})
        </span>
        <ChoiceBadge chosen={node.chosen} />
        <span className="shrink-0 text-xs text-navy-300">
          Acheter :{" "}
          {node.buyPrice != null ? (
            <>
              {money(node.buyPrice)}{" "}
              <span
                title={`Fraîcheur : ${ageLabel(node.buyPriceAge)}${
                  buyIsStale ? " — ce prix peut être obsolète (ordre déjà vendu), vérifiez en jeu" : ""
                }`}
                className={buyIsStale ? "font-semibold text-red-400" : "text-navy-500"}
              >
                ({ageLabel(node.buyPriceAge)}
                {buyIsStale ? " ⚠" : ""})
              </span>
              {node.buyPriceCity && (
                <span
                  title="Ville d'où provient ce prix d'achat"
                  className="ml-1 rounded bg-navy-700 px-1 text-[10px] text-navy-300"
                >
                  {node.buyPriceCity}
                </span>
              )}
            </>
          ) : (
            "n/a"
          )}
        </span>
        <span className="shrink-0 text-xs text-navy-300">
          Fabriquer : {node.bestCraftOption != null ? money(node.bestCraftOption.totalCost) : "n/a"}
        </span>
        {gap != null && (
          <span className={`shrink-0 text-xs ${gap >= 0 ? "text-green-400" : "text-red-400"}`}>
            écart {gap >= 0 ? "+" : ""}
            {money(gap)}
          </span>
        )}
        {node.saleRate != null ? (
          <span
            title="Ventes moyennes/jour (AODP)"
            className={`shrink-0 rounded px-1 text-[10px] ${
              node.liquidityOk === false ? "bg-amber-900 text-amber-200" : "bg-navy-700 text-navy-200"
            }`}
          >
            {node.saleRate.toFixed(1)}/j
          </span>
        ) : (
          <span className="shrink-0 rounded bg-amber-800 px-1 text-[10px] text-amber-100">?</span>
        )}
        {node.chosenCost == null && priceMode === "manual" && (
          <input
            type="number"
            min={0}
            placeholder="prix manuel"
            value={manualPrices[node.marketId] ?? ""}
            onChange={(e) => onManualPriceChange(node.marketId, parseFloat(e.target.value) || 0)}
            className="w-24 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-xs text-navy-100"
          />
        )}
      </div>
      {isOpen && node.bestCraftOption && (
        <div className="flex flex-col">
          {node.bestCraftOption.children.map((child) => (
            <ResourceNodeRow
              key={child.uniqueName}
              line={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              nameOf={nameOf}
              manualPrices={manualPrices}
              onManualPriceChange={onManualPriceChange}
              priceMode={priceMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MakeOrBuyTree({
  item,
  recipe,
  ctx,
  nameOf,
  outputPriceOf,
  netSellRateOf,
  memo,
  onManualPriceChange,
  manualPrices,
  priceMode,
  onClose,
}: {
  item: CraftItem;
  recipe: CraftRecipe;
  ctx: EvalContext;
  nameOf: (uniqueName: string) => string;
  outputPriceOf: OutputPriceLookup;
  netSellRateOf: (gross: number) => number;
  memo: Map<string, ResourceTreeNode>;
  onManualPriceChange: (marketId: string, value: number) => void;
  manualPrices: Record<string, number>;
  priceMode: PriceMode;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const result = useMemo(
    () => evaluateFinalItem(item, recipe, ctx, outputPriceOf, netSellRateOf, memo),
    [item, recipe, ctx, outputPriceOf, netSellRateOf, memo],
  );

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Arbre acheter/fabriquer — {nameOf(item.uniqueName)} (enchant {recipe.enchant})
          {result.craft.citySpecialty && (
            <span
              title={`Spécialité de craft de ${ctx.simulationCity} (+15% de bonus de production, sauf si vous avez saisi un taux réel pour ce type d'objet)`}
              className="rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-navy-950"
            >
              spécialité {ctx.simulationCity}
            </span>
          )}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-navy-400 hover:text-navy-100">
          Fermer ✕
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded border border-navy-700 bg-navy-900 p-3 text-sm sm:grid-cols-5">
        <div>
          <p className="text-xs uppercase text-navy-500">Coût de craft</p>
          <p className="text-navy-100">{money(result.craft.craftCost)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-navy-500">Taux de retour</p>
          <p className="text-navy-100">
            {(result.craft.returnRate * 100).toFixed(1)}%
            {result.craft.citySpecialty && <span className="ml-1 text-gold-400">★</span>}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-navy-500">Vente nette</p>
          <p className="text-navy-100">{result.sellPriceNet != null ? money(result.sellPriceNet) : "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-navy-500">Marge</p>
          <p className={(result.marginNet ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
            {result.marginNet != null ? money(result.marginNet) : "-"}
            {result.marginPct != null ? ` (${(result.marginPct * 100).toFixed(1)}%)` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-navy-500">Argent / Focus</p>
          <p className="text-navy-100">{result.silverPerFocus != null ? result.silverPerFocus.toFixed(2) : "-"}</p>
        </div>
      </div>

      {result.craft.missingPrices.length > 0 && (
        <p className="mb-2 text-xs text-amber-400">Prix manquants : {result.craft.missingPrices.join(", ")}</p>
      )}

      <div className="flex flex-col">
        {result.craft.children.map((line) => (
          <ResourceNodeRow
            key={line.uniqueName}
            line={line}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            nameOf={nameOf}
            manualPrices={manualPrices}
            onManualPriceChange={onManualPriceChange}
            priceMode={priceMode}
          />
        ))}
      </div>
    </section>
  );
}
