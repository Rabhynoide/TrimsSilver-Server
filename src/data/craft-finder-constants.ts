// Same philosophy as crafting-constants.ts: these stay plain, documented
// defaults the user tunes per city/workshop from their own in-game
// crafting/refining window — never guessed "typical" numbers. The one
// exception is Return Rate (see defaultReturnRateForCity below), which
// Albion derives from a public, documented formula rather than a live
// player-set value, so a real default table is possible there — unlike the
// station's Usage Fee rate, which stays impossible to default (see
// NUTRITION_COST_PER_ITEM_VALUE's own comment).

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

// Default Return Rate per (city, category), derived from Albion's own
// "Local Production Bonus" system — confirmed against
// wiki.albiononline.com/wiki/Local_Production_Bonus and
// .../wiki/Resource_return_rate, cross-checked against the city bonus table
// the user linked (reddit.com/r/albiononline city refining/crafting bonuses
// post). Every city with actual crafting/refining stations (all 7 of
// CITIES except "Black Market", a trading-only hub) grants a flat +18
// production-bonus baseline to every category. On top of that:
//
// - Each of the 5 royal cities specializes in exactly one raw-resource
//   refining category (+40 bonus) — Caerleon and Brecilien have none.
// - A +15 crafting specialization also exists everywhere, but outside the
//   two exceptions below it targets one specific weapon/armor slot inside
//   a workshop, not the workshop's whole catalog (e.g. Martlock's crafting
//   bonus is Axe only, not every Warrior's Forge item) — too granular for
//   this feature's per-(city, workshop) config, so it's left out of the
//   per-workshop default rather than overstate every royal city's numbers.
//   The two exceptions are (near-)full-workshop matches worth including:
//   Caerleon's crafting specialty list includes "gathering tools" in full
//   (= all of Toolmaker), and Brecilien's includes bags + capes (2 of
//   Workbench's 3 item types, offhands excluded).
//
// A production-bonus percentage converts to an actual Return Rate via
// Albion's own formula: 1 - 1/(1 + bonus/100). None of this accounts for
// spec levels, active daily production bonuses, or Focus (which the wiki
// documents as a flat +59 to the production bonus on top of everything
// above) — all per-player/per-craft choices, not per-city constants — so
// this is a starting point the user is still expected to correct against
// their own in-game window, same as the station fee rate below it.
const PRODUCTION_BONUS_BASE_PCT = 18;
const PRODUCTION_BONUS_REFINING_SPECIALTY_PCT = 40;
const PRODUCTION_BONUS_CRAFTING_SPECIALTY_PCT = 15;

function productionBonusToReturnRate(bonusPct: number): number {
  return 1 - 1 / (1 + bonusPct / 100);
}

const REFINING_SPECIALTY_BY_CITY: Partial<Record<string, CraftFinderRefiningCategory>> = {
  "Fort Sterling": "planks",
  Lymhurst: "cloth",
  Martlock: "leather",
  Bridgewatch: "stoneblock",
  Thetford: "metalbar",
};

const WORKSHOP_SPECIALTY_BY_CITY: Partial<Record<string, CraftFinderWorkshop>> = {
  Caerleon: "toolmaker",
  Brecilien: "workbench",
};

export function defaultReturnRateForCity(city: string, category: CraftFinderNodeCategory): number {
  if (city === "Black Market") return 0;
  let bonus = PRODUCTION_BONUS_BASE_PCT;
  if (REFINING_SPECIALTY_BY_CITY[city] === category) bonus += PRODUCTION_BONUS_REFINING_SPECIALTY_PCT;
  if (WORKSHOP_SPECIALTY_BY_CITY[city] === category) bonus += PRODUCTION_BONUS_CRAFTING_SPECIALTY_PCT;
  return productionBonusToReturnRate(bonus);
}
