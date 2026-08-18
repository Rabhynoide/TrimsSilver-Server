"use client";

import { AODP_REGIONS } from "@/lib/aodp";
import { LOCATION_BONUS_STEMS, FARMING_LOCATIONS, type FarmingLocation } from "@/data/farming-constants";
import type { FarmingRecipe, FarmingSpecDef } from "./calc";
import { isPlantRecipe } from "./calc";
import { salesTaxRateFor, setupFeeRateFor, type FarmingConfig, type PriceMode, type SpecCharacter } from "./types";

function bonusedItemsAt(location: FarmingLocation, recipes: FarmingRecipe[]): FarmingRecipe[] {
  const stems = LOCATION_BONUS_STEMS[location];
  return recipes.filter((recipe) => {
    const uniqueName = isPlantRecipe(recipe) ? recipe.seedUniqueName : recipe.babyUniqueName;
    return stems.some((stem) => uniqueName.includes(`_${stem}`));
  });
}

function recipeIconId(recipe: FarmingRecipe): string {
  return isPlantRecipe(recipe) ? recipe.seedUniqueName : recipe.babyUniqueName;
}

function recipeDisplayName(recipe: FarmingRecipe): string {
  return recipe.name;
}

const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  current: "AODP Current",
  average: "AODP Average",
  emv: "My EMV",
  manual: "Manual",
};

export default function SettingsPanel({
  config,
  onChange,
  isSignedIn,
  characters,
  specs,
  recipes,
  onSelectCharacter,
  onRefreshSpecs,
  onSave,
  saving,
  onSignIn,
  cities,
}: {
  config: FarmingConfig;
  onChange: (updater: (c: FarmingConfig) => FarmingConfig) => void;
  isSignedIn: boolean;
  characters: SpecCharacter[];
  specs: FarmingSpecDef[];
  recipes: FarmingRecipe[];
  onSelectCharacter: (characterName: string) => void;
  onRefreshSpecs: () => void;
  onSave: () => void;
  saving: boolean;
  onSignIn: () => void;
  cities: readonly string[];
}) {
  const bonusedItems = bonusedItemsAt(config.location, recipes);
  const priceModes: PriceMode[] = isSignedIn
    ? ["current", "average", "emv", "manual"]
    : ["current", "average", "manual"];

  const groups: { key: FarmingSpecDef["group"]; label: string }[] = [
    { key: "crops", label: "Crop Farmer" },
    { key: "animals", label: "Animal Breeder" },
    { key: "herbs", label: "Herbalist" },
  ];

  function setSpec(id: string, level: number) {
    onChange((c) => ({ ...c, specs: { ...c.specs, [id]: Math.max(0, Math.min(100, level)) } }));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Farming Location
        </h2>
        <label className="flex flex-col gap-1 text-sm text-navy-300">
          Location
          <select
            value={config.location}
            onChange={(e) => onChange((c) => ({ ...c, location: e.target.value as FarmingLocation }))}
            className="w-48 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
          >
            {FARMING_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>

        {bonusedItems.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-navy-400">
              {config.location} local production bonus (+10% output amount — not seed/offspring
              return chance)
            </p>
            <div className="flex flex-wrap gap-2">
              {bonusedItems.map((recipe) => (
                <div
                  key={recipeIconId(recipe)}
                  className="flex items-center gap-2 rounded border border-navy-600 bg-navy-900 px-2 py-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://render.albiononline.com/v1/item/${recipeIconId(recipe)}.png`}
                    alt=""
                    className="h-6 w-6"
                  />
                  <span className="text-xs text-navy-200">
                    {recipeDisplayName(recipe)} [{recipe.tier}.0]
                  </span>
                  <span className="text-xs font-semibold text-gold-400">+10% output</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          User Settings
        </h2>
        <label className="flex items-center gap-2 text-sm text-navy-300">
          <input
            type="checkbox"
            checked={config.premium}
            onChange={(e) => onChange((c) => ({ ...c, premium: e.target.checked }))}
          />
          Premium
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-navy-300">
          <input
            type="checkbox"
            checked={config.useFocus}
            onChange={(e) => onChange((c) => ({ ...c, useFocus: e.target.checked }))}
          />
          Use Focus (watering/nurturing)
        </label>
        {!config.useFocus && (
          <p className="mt-1 text-xs text-navy-400">
            Results use base tier yield only — no spec bonus, no Focus cost.
          </p>
        )}
        <label className="mt-2 flex items-center gap-2 text-sm text-navy-300">
          Production slots
          <input
            type="number"
            min={0}
            value={config.slots}
            onChange={(e) => onChange((c) => ({ ...c, slots: parseInt(e.target.value, 10) || 0 }))}
            className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
          />
        </label>
        <p className="mt-1 text-xs text-navy-400">
          1 field/pasture = 9 slots. Used only for the &quot;Total Profit/Day&quot; column in
          Results — an estimate of real earnings if every slot ran that item.
        </p>
        <p className="mt-2 text-xs text-navy-400">
          Sales tax {(salesTaxRateFor(config.premium) * 100).toFixed(2)}%
        </p>
        <p className="text-xs text-navy-400">
          Setup fee {(setupFeeRateFor(config.premium) * 100).toFixed(2)}%
        </p>
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Market Settings
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Region
            <select
              value={config.region}
              onChange={(e) =>
                onChange((c) => ({ ...c, region: e.target.value as FarmingConfig["region"] }))
              }
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {AODP_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Buy From
            <select
              value={config.buyFrom}
              onChange={(e) => onChange((c) => ({ ...c, buyFrom: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Sell To
            <select
              value={config.sellTo}
              onChange={(e) => onChange((c) => ({ ...c, sellTo: e.target.value }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Price Mode
            <select
              value={config.priceMode}
              onChange={(e) => onChange((c) => ({ ...c, priceMode: e.target.value as PriceMode }))}
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {priceModes.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          {config.priceMode === "average" && (
            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Average Days
              <input
                type="number"
                min={1}
                max={90}
                value={config.averageDays}
                onChange={(e) =>
                  onChange((c) => ({ ...c, averageDays: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              />
            </label>
          )}
        </div>
        {config.priceMode === "manual" && (
          <p className="mt-2 text-xs text-navy-400">
            Set manual prices per item from the Results tab (click a missing-price row).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Specs</h2>
        {isSignedIn ? (
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Character
              <select
                value={config.characterName ?? ""}
                onChange={(e) => onSelectCharacter(e.target.value)}
                className="w-48 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              >
                <option value="" disabled>
                  Select a character
                </option>
                {characters.map((c) => (
                  <option key={c.characterName} value={c.characterName}>
                    {c.characterName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onRefreshSpecs}
              className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
            >
              Refresh Specs
            </button>
            {characters.length === 0 && (
              <p className="text-xs text-navy-400">
                No synced characters yet — make sure &quot;Upload Specs to TrimsSilver&quot; is
                enabled in TrimsSilver-Client, or enter levels manually below.
              </p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-xs text-navy-400">
            Sign in with Discord to auto-fill from your TrimsSilver-Client synced characters, or
            enter levels manually below.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {groups.map((group) => {
            const defs = specs.filter((s) => s.group === group.key);
            const root = defs.find((s) => s.isCategoryRoot);
            const children = defs.filter((s) => !s.isCategoryRoot);
            return (
              <div key={group.key} className="flex flex-col gap-1">
                {root && (
                  <label className="flex items-center justify-between gap-2 text-sm font-semibold text-navy-100">
                    {root.name}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.specs[root.id] ?? 0}
                      onChange={(e) => setSpec(root.id, parseInt(e.target.value, 10) || 0)}
                      className="w-16 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
                    />
                  </label>
                )}
                {children.map((spec) => (
                  <label
                    key={spec.id}
                    className="flex items-center justify-between gap-2 pl-3 text-xs text-navy-300"
                  >
                    {spec.name}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.specs[spec.id] ?? 0}
                      onChange={(e) => setSpec(spec.id, parseInt(e.target.value, 10) || 0)}
                      className="w-14 rounded border border-navy-600 bg-navy-900 px-1.5 py-0.5 text-navy-100"
                    />
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!isSignedIn || saving}
          title={!isSignedIn ? "Sign in with Discord to save settings" : undefined}
          className="rounded border border-navy-600 px-4 py-2 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {!isSignedIn && (
          <button
            type="button"
            onClick={onSignIn}
            className="rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:bg-[#4752C4]"
          >
            Se connecter avec Discord
          </button>
        )}
      </div>
    </div>
  );
}
