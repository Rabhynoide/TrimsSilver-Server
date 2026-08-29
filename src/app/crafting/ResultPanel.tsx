"use client";

import type { EvalResult } from "./calc";
import type { CraftingConfig } from "./types";
import type { CatalogItem } from "../market-prices/types";

function money(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function ResultPanel({
  itemName,
  result,
  config,
  catalog,
  onManualPriceChange,
}: {
  itemName: string;
  result: EvalResult;
  config: CraftingConfig;
  catalog: CatalogItem[];
  onManualPriceChange: (uniqueName: string, value: number) => void;
}) {
  const hasMissingPrices = result.missingPrices.length > 0;
  const nameOf = (uniqueName: string) =>
    catalog.find((i) => i.uniqueName === uniqueName)?.name ?? uniqueName;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-4 rounded-lg border border-navy-700 bg-navy-850 p-4 sm:grid-cols-4">
        <Stat label="Coût / fabrication" value={`${money(result.costPerCraft)} argent`} />
        <Stat label="Revenu / fabrication" value={`${money(result.revenuePerCraft)} argent`} />
        <Stat
          label="Profit / fabrication"
          value={`${money(result.profitPerCraft)} argent`}
          highlight={result.profitPerCraft >= 0 ? "positive" : "negative"}
        />
        <Stat label="ROI" value={result.roi != null ? `${(result.roi * 100).toFixed(1)}%` : "—"} />
        <Stat label={`Coût × ${config.batchSize}`} value={`${money(result.costTotal)} argent`} />
        <Stat label={`Revenu × ${config.batchSize}`} value={`${money(result.revenueTotal)} argent`} />
        <Stat
          label={`Profit × ${config.batchSize}`}
          value={`${money(result.profitTotal)} argent`}
          highlight={result.profitTotal >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Profit / Focus"
          value={result.profitPerFocus != null ? result.profitPerFocus.toFixed(2) : "—"}
        />
      </section>

      {hasMissingPrices && (
        <p className="rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Prix manquant pour : {result.missingPrices.filter((n) => n !== "output").map(nameOf).join(", ")}
          {result.missingPrices.includes("output") ? " (objet produit)" : ""}
        </p>
      )}

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Détail des ressources — {itemName}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="divide-x divide-navy-700 border-b border-navy-700 text-left text-xs uppercase tracking-wide text-navy-400">
                <th className="px-2 py-1.5">Ressource</th>
                <th className="px-2 py-1.5 text-right">Qté</th>
                <th className="px-2 py-1.5 text-right">Qté nette (après taux de retour)</th>
                <th className="px-2 py-1.5 text-right">Prix unitaire</th>
                <th className="px-2 py-1.5 text-right">Coût de la ligne</th>
              </tr>
            </thead>
            <tbody>
              {result.resourceLines.map((line) => (
                <tr key={line.uniqueName} className="divide-x divide-navy-800 border-b border-navy-800">
                  <td className="flex items-center gap-2 px-2 py-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://render.albiononline.com/v1/item/${line.uniqueName}.png`}
                      alt=""
                      className="h-6 w-6"
                    />
                    <span className="text-navy-100">{nameOf(line.uniqueName)}</span>
                    {line.unitPrice == null && config.priceMode === "manual" && (
                      <input
                        type="number"
                        min={0}
                        value={config.manualPrices[line.uniqueName] ?? ""}
                        onChange={(e) =>
                          onManualPriceChange(line.uniqueName, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-20 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-navy-300">{line.count}</td>
                  <td className="px-2 py-1.5 text-right text-navy-300">{line.netUnits.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-navy-300">
                    {line.unitPrice != null ? money(line.unitPrice) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-navy-100">{money(line.lineCost)}</td>
                </tr>
              ))}
              {result.silverFeePerCraft > 0 && (
                <tr className="border-b border-navy-800 text-navy-300">
                  <td className="px-2 py-1.5" colSpan={4}>
                    Frais de fabrication (argent)
                  </td>
                  <td className="px-2 py-1.5 text-right">{money(result.silverFeePerCraft)}</td>
                </tr>
              )}
              {result.stationFeePerCraft > 0 && (
                <tr className="border-b border-navy-800 text-navy-300">
                  <td className="px-2 py-1.5" colSpan={4}>
                    Frais d&apos;utilisation de la station ({(config.stationFeeRate * 100).toFixed(1)}% du coût
                    des ressources)
                  </td>
                  <td className="px-2 py-1.5 text-right">{money(result.stationFeePerCraft)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {config.useFocus && (
          <p className="mt-3 text-xs text-navy-400">
            Coût en Focus / fabrication : {result.focusCostPerCraft} (valeur de base du jeu — l&apos;Efficacité
            du coût en Focus de la spécialisation la réduit en jeu mais n&apos;est pas modélisée ici, voir le
            plan)
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-navy-400">{label}</span>
      <span
        className={`text-lg font-semibold ${
          highlight === "positive"
            ? "text-green-400"
            : highlight === "negative"
              ? "text-red-400"
              : "text-navy-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
