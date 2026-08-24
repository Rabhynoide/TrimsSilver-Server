// Small, stable constants that aren't extractable from ao-bin-dumps (unlike
// src/data/farming-catalog.json, which is script-generated) — sourced from
// wiki.albiononline.com/wiki/Farming (fetched 2026-08-18) and cross-checked
// against the user's own AFM screenshot (Lymhurst's bonus cards matched
// exactly: Carrot Seeds/Crenellated Burdock Seeds/Goose/Pumpkin Seeds, all
// +10%). See the Farming & Breeding Calculator plan for the full derivation.

export { DEFAULT_SALES_TAX, DEFAULT_SETUP_FEE } from "./market-constants";

export const FARMING_LOCATIONS = [
  "Bridgewatch",
  "Caerleon",
  "Fort Sterling",
  "Lymhurst",
  "Martlock",
  "Thetford",
  "Brecilien",
] as const;

export type FarmingLocation = (typeof FARMING_LOCATIONS)[number];

// +10% bonus per Royal city, keyed by the uniqueName "stem" token (e.g.
// T1_FARM_CARROT_SEED contains "CARROT"). Brecilien uniquely bonuses *all*
// crops (not herbs, not animals); Caerleon uniquely gets 3 herbs.
// Confirmed live in-game (user screenshot, Firetouched Mullein Seeds at
// Thetford): this "Local" bonus applies to "Production de produits" — the
// harvested output amount — NOT to seed/offspring return chance ("Production
// de graines", which is exactly the tier base chance + the separate,
// item-fixed watering bonus, no city term at all). See averageAmount().
export const LOCATION_BONUS_STEMS: Record<FarmingLocation, string[]> = {
  Bridgewatch: ["BEAN", "CORN", "GOAT", "TEASEL"],
  Caerleon: ["COMFREY", "TEASEL", "MULLEIN"],
  "Fort Sterling": ["TURNIP", "YARROW", "CHICKEN", "SHEEP"],
  Lymhurst: ["CARROT", "PUMPKIN", "BURDOCK", "GOOSE"],
  Martlock: ["WHEAT", "POTATO", "FOXGLOVE", "COW"],
  Thetford: ["CABBAGE", "AGARIC", "MULLEIN", "PIG"],
  Brecilien: ["CARROT", "BEAN", "WHEAT", "TURNIP", "CABBAGE", "POTATO", "CORN", "PUMPKIN"],
};

export const LOCATION_BONUS_FRACTION = 0.1;

export function hasLocationBonus(uniqueName: string, location: FarmingLocation): boolean {
  const stems = LOCATION_BONUS_STEMS[location];
  return stems.some((stem) => uniqueName.includes(`_${stem}`));
}

// Universal, well-documented premium modifiers for farming/breeding.
export const PREMIUM_YIELD_MULTIPLIER = 2;
export const PREMIUM_FAME_MULTIPLIER = 2;
export const PREMIUM_GROW_TIME_MULTIPLIER = 0.5;

// Focus cost interpolates from the recipe's own baseFocusCost (spec 0) down to
// this floor (spec 100) — confirmed empirically against a user screenshot (a
// ~91 spec character's watering cost matched this linear formula almost
// exactly). The watering/nurture yield bonus itself is NOT spec-scaled: it's
// a flat, item-fixed amount (the recipe's own maxFocusBonus) applied in full
// whenever watering happens — also confirmed from the same screenshot, where
// the displayed "Arrosage: +17.78%" matched the item's raw maxFocusBonus
// exactly, not some fraction of it. Spec level only makes watering cheaper in
// Focus, not more effective.
export const FOCUS_COST_FLOOR = 125;
export const FOCUS_COST_SPEC_MAX = 100;

// Default market fees moved to src/data/market-constants.ts (re-exported
// above) since they're generic to any sell order, not farming-specific —
// Crafting reuses the same constants.
