// Same philosophy as crafting-constants.ts: no invented per-category Return
// Rate/station-fee table exists in a form worth hardcoding, so these stay
// plain, documented defaults the user tunes per city/workshop from their own
// in-game crafting/refining window — never guessed "typical" numbers.

// The 5 real Albion crafting buildings equipment is made at — confirmed
// against the wiki's crafting-station guides and patch notes, not guessed
// (see scripts/build-crafting-catalog.mjs's own mapping comment for the
// full @craftingcategory → workshop table). Every equipment item in
// crafting-catalog.json carries its own `workshop` field already resolved
// to one of these five.
export const CRAFT_FINDER_WORKSHOPS = [
  "warriors_forge",
  "hunters_lodge",
  "mages_tower",
  "toolmaker",
  "workbench",
] as const;
export type CraftFinderWorkshop = (typeof CRAFT_FINDER_WORKSHOPS)[number];

export const CRAFT_FINDER_WORKSHOP_LABELS_FR: Record<CraftFinderWorkshop, string> = {
  warriors_forge: "Forge du guerrier",
  hunters_lodge: "Repaire du chasseur",
  mages_tower: "Tour du mage",
  toolmaker: "Fabricant d'outils",
  workbench: "Établi",
};

// The 5 refined-resource categories from resource-catalog.json. Raw
// resources (ore/wood/hide/fiber/rock) are deliberately NOT a category here
// — they're never crafted/refined in this feature's scope (the raw-resource
// "Resource Transmutation" mechanic is intentionally not modeled, see
// build-resource-catalog.mjs), so they never incur a station fee or need a
// Return Rate of their own.
export const CRAFT_FINDER_REFINING_CATEGORIES = [
  "metalbar",
  "planks",
  "leather",
  "cloth",
  "stoneblock",
] as const;
export type CraftFinderRefiningCategory = (typeof CRAFT_FINDER_REFINING_CATEGORIES)[number];

export const CRAFT_FINDER_REFINING_LABELS_FR: Record<CraftFinderRefiningCategory, string> = {
  metalbar: "Raffinage de barres de métal",
  planks: "Raffinage de planches",
  leather: "Raffinage de cuir",
  cloth: "Raffinage de tissu",
  stoneblock: "Raffinage de blocs de pierre",
};

// The full set of "node categories" the make-or-buy tree's Return
// Rate/station-fee config spans: every equipment workshop plus every
// refining category. One Return Rate / station-fee slot per (city,
// category) pair — see types.ts's CraftFinderConfig.cityCategoryConfig —
// rather than per individual tree node (there can be dozens of resource
// nodes in one item's full tree), mirroring how /crafting itself only
// exposes one Return Rate field for the whole craft today.
export const CRAFT_FINDER_NODE_CATEGORIES = [
  ...CRAFT_FINDER_WORKSHOPS,
  ...CRAFT_FINDER_REFINING_CATEGORIES,
] as const;
export type CraftFinderNodeCategory = (typeof CRAFT_FINDER_NODE_CATEGORIES)[number];

export const CRAFT_FINDER_CATEGORY_LABELS_FR: Record<CraftFinderNodeCategory, string> = {
  ...CRAFT_FINDER_WORKSHOP_LABELS_FR,
  ...CRAFT_FINDER_REFINING_LABELS_FR,
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

// Confirmed against Albion's official "Usage Fee and Crafting Changes"
// patch notes (Lands Awakened update): a crafting station's Usage Fee is
// Nutrition Cost (= Item Value × this constant) turned into silver at the
// station's own posted "silver per 100 Nutrition" rate — a live value the
// station's owner sets, not a fixed game constant, hence why it stays a
// manual per-(city, category) input in CraftFinderConfig rather than
// something derived automatically.
export const NUTRITION_COST_PER_ITEM_VALUE = 0.1125;

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

// Rule of thumb from community crafting guides (e.g. Nendys' "Crafting
// Masterclass"): craft no more than ~20-30% of an item's own daily traded
// volume, or you end up re-listing (and re-paying the 2.5% setup fee each
// time) faster than the market actually absorbs your stock. Same kind of
// documented approximation as TIER_LIQUIDITY_SCALE above — used only to size
// an informational "max volume to craft per day" figure, not a hard filter.
export const MAX_CRAFT_SHARE_OF_DAILY_VOLUME = 0.25;
