// Small, stable constants that aren't extractable from ao-bin-dumps (unlike
// src/data/farming-catalog.json, which is script-generated) — sourced from
// wiki.albiononline.com/wiki/Farming (fetched 2026-08-18) and cross-checked
// against the user's own AFM screenshot (Lymhurst's bonus cards matched
// exactly: Carrot Seeds/Crenellated Burdock Seeds/Goose/Pumpkin Seeds, all
// +10%). See the Farming & Breeding Calculator plan for the full derivation.

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

// +10% yield bonus per Royal city, keyed by the uniqueName "stem" token
// (e.g. T1_FARM_CARROT_SEED contains "CARROT"). Brecilien uniquely bonuses
// *all* crops (not herbs, not animals); Caerleon uniquely gets 3 herbs.
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
// this floor (spec 100); nurture yield bonus interpolates from 0 up to the
// recipe's own maxFocusBonus over the same 0-100 range. The wiki only
// documents the two endpoints, not the curve shape, so this is treated as
// linear — a documented approximation, not a guess at raw values.
export const FOCUS_COST_FLOOR = 125;
export const FOCUS_COST_SPEC_MAX = 100;

// Default market fees (editable in Settings — these are just sensible
// defaults, not hardcoded truth). Premium values confirmed against the user's
// own screenshot ("Sales tax 4.00%, Setup fee 2.50%" with Premium checked).
export const DEFAULT_SALES_TAX = { premium: 0.04, standard: 0.08 };
export const DEFAULT_SETUP_FEE = { premium: 0.025, standard: 0.03 };
