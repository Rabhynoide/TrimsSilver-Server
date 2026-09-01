// Same philosophy as crafting-constants.ts: no invented per-category Return
// Rate/station-fee table exists in a form worth hardcoding, so these stay
// plain, documented defaults the user tunes per category from their own
// in-game crafting/refining window — never guessed "typical" numbers.

// One Return Rate / station-fee-rate / Focus-toggle slot per node category
// in the make-or-buy tree: the final equipment craft, plus each of the 10
// resource categories from resource-catalog.json (5 raw — used for the
// silver-only Resource Transmutation recipes some enchanted raw resources
// carry — and 5 refined). Keeping this per-category rather than per
// individual tree node (there can be dozens of resource nodes in one item's
// full tree) mirrors how /crafting itself only exposes one Return Rate
// field for the whole craft today — a tree-wide form field per node would be
// unusable.
export const CRAFT_FINDER_NODE_CATEGORIES = [
  "equipment",
  "ore",
  "wood",
  "hide",
  "fiber",
  "rock",
  "metalbar",
  "planks",
  "leather",
  "cloth",
  "stoneblock",
] as const;
export type CraftFinderNodeCategory = (typeof CRAFT_FINDER_NODE_CATEGORIES)[number];

export const CRAFT_FINDER_CATEGORY_LABELS_FR: Record<CraftFinderNodeCategory, string> = {
  equipment: "Fabrication d'équipement",
  ore: "Transmutation de minerai",
  wood: "Transmutation de bois",
  hide: "Transmutation de peau",
  fiber: "Transmutation de fibre",
  rock: "Transmutation de pierre",
  metalbar: "Raffinage de barres de métal",
  planks: "Raffinage de planches",
  leather: "Raffinage de cuir",
  cloth: "Raffinage de tissu",
  stoneblock: "Raffinage de blocs de pierre",
};

// Sale rate (avg items sold/day, from AODP history's item_count) below which
// a combination is flagged "low liquidity". Deliberately relative to tier,
// not a single flat number for every tier — a T8 item naturally trades far
// less often than a T4 one, so a flat threshold would either exclude almost
// every high-tier item or let through illiquid low-tier ones. The tier
// curve below is a documented approximation (no published AODP-wide "normal
// volume per tier" baseline exists to calibrate against precisely), roughly
// halving the threshold every two tiers — same spirit as the other
// deliberately-approximate curves already in this codebase (see
// farming/calc.ts's focusCost() interpolation).
export const DEFAULT_MIN_SALE_RATE_PER_DAY = 5;

const TIER_LIQUIDITY_SCALE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 0.75,
  6: 0.5,
  7: 0.35,
  8: 0.25,
};

export function minSaleRateForTier(tier: number, baseRate: number): number {
  return baseRate * (TIER_LIQUIDITY_SCALE[tier] ?? 1);
}

// Craft Finder's ranking always prices the whole equipment catalog, so
// (like Farming/Journals) its item universe is worth caching in full rather
// than live-proxying on every page load — but only at this one enchant
// level (quality is always 1, per the feature's own scope, so that
// dimension needs no such tradeoff). Enchanted variants (1-4) stay
// live-proxied on demand, same cardinality tradeoff already documented for
// excluding /crafting's full catalog from the cache (schema.prisma's
// CachedMarketPrice doc) — caching all 5 enchant levels × 8 cities for 768
// items would reproduce that same disqualifying volume.
export const CRAFT_FINDER_CACHED_ENCHANT = 0;
