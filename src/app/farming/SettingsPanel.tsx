"use client";

import { AODP_REGIONS, REGION_LABELS_FR } from "@/lib/aodp";
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
  current: "AODP Actuel",
  average: "AODP Moyen",
  emv: "Mon EMV",
  manual: "Manuel",
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
    { key: "crops", label: "Agriculteur" },
    { key: "animals", label: "Éleveur" },
    { key: "herbs", label: "Herboriste" },
  ];

  function setSpec(id: string, level: number) {
    onChange((c) => ({ ...c, specs: { ...c.specs, [id]: Math.max(0, Math.min(100, level)) } }));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Lieu de production
        </h2>
        <label className="flex flex-col gap-1 text-sm text-navy-300">
          Lieu
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
              Bonus de production locale de {config.location} (+10% de quantité produite — pas la
              chance de récupération de graine/petit)
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
                  <span className="text-xs font-semibold text-gold-400">+10% de production</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Paramètres utilisateur
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
          Utiliser la Concentration (arrosage/soin)
        </label>
        {!config.useFocus && (
          <p className="mt-1 text-xs text-navy-400">
            Les résultats utilisent uniquement le rendement de base du tier — pas de bonus de
            spécialisation, pas de coût en Concentration.
          </p>
        )}
        <label className="mt-2 flex items-center gap-2 text-sm text-navy-300">
          Emplacements de production
          <input
            type="number"
            min={0}
            value={config.slots}
            onChange={(e) => onChange((c) => ({ ...c, slots: parseInt(e.target.value, 10) || 0 }))}
            className="w-20 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
          />
        </label>
        <p className="mt-1 text-xs text-navy-400">
          1 champ/pâturage = 9 emplacements. Utilisé uniquement pour la colonne &quot;Profit total
          / jour&quot; des résultats — une estimation des gains réels si chaque emplacement
          produisait cet article.
        </p>
        <p className="mt-2 text-xs text-navy-400">
          Taxe de vente {(salesTaxRateFor(config.premium) * 100).toFixed(2)}%
        </p>
        <p className="text-xs text-navy-400">
          Frais de placement {(setupFeeRateFor(config.premium) * 100).toFixed(2)}%
        </p>
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Paramètres du marché
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Région
            <select
              value={config.region}
              onChange={(e) =>
                onChange((c) => ({ ...c, region: e.target.value as FarmingConfig["region"] }))
              }
              className="rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
            >
              {AODP_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS_FR[region]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-navy-300">
            Acheter à
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
            Vendre à
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
            Mode de prix
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
              Jours de moyenne
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
            Définissez les prix manuels par article depuis l&apos;onglet Résultats (cliquez sur une
            ligne avec un prix manquant).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-navy-700 bg-navy-850 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Spécialisations
        </h2>
        {isSignedIn ? (
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-navy-300">
              Personnage
              <select
                value={config.characterName ?? ""}
                onChange={(e) => onSelectCharacter(e.target.value)}
                className="w-48 rounded border border-navy-600 bg-navy-900 px-2 py-1 text-navy-100"
              >
                <option value="" disabled>
                  Sélectionner un personnage
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
              Actualiser les spécialisations
            </button>
            {characters.length === 0 && (
              <p className="text-xs text-navy-400">
                Aucun personnage synchronisé pour l&apos;instant — assurez-vous que &quot;Upload
                Specs to TrimsSilver&quot; est activé dans TrimsSilver-Client, ou saisissez les
                niveaux manuellement ci-dessous.
              </p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-xs text-navy-400">
            Connectez-vous avec Discord pour pré-remplir avec vos personnages synchronisés depuis
            TrimsSilver-Client, ou saisissez les niveaux manuellement ci-dessous.
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
          title={!isSignedIn ? "Connectez-vous avec Discord pour enregistrer les paramètres" : undefined}
          className="rounded border border-navy-600 px-4 py-2 text-sm text-navy-200 hover:bg-navy-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
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
