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

// Every raw @craftingcategory value that appears in crafting-catalog.json,
// grouped by the workshop it belongs to (same grouping as
// build-crafting-catalog.mjs's own CRAFTING_CATEGORY_TO_WORKSHOP table,
// duplicated here for the runtime config UI rather than imported since that
// script isn't part of the app bundle) — this is the finer weapon/armor-type
// breakdown the city crafting specialty (CRAFTING_SPECIALTY_CITY_BY_CATEGORY
// below) actually targets, one specific type at a time, not a whole
// workshop. Exposed so the per-city config table can let the user enter
// their own real observed Return Rate per item type — the only way to
// actually capture spec level, an active daily bonus, and Focus's own +59
// production-bonus effect, none of which this app derives on its own (see
// this file's other comments) — instead of just the workshop-wide average.
export const CRAFT_FINDER_ITEM_TYPES_BY_WORKSHOP: Record<CraftFinderWorkshop, string[]> = {
  warriors_forge: [
    "sword",
    "axe",
    "mace",
    "dagger",
    "spear",
    "quarterstaff",
    "hammer",
    "knuckles",
    "plate_helmet",
    "plate_armor",
    "plate_shoes",
  ],
  hunters_lodge: ["bow", "crossbow", "leather_helmet", "leather_armor", "leather_shoes"],
  mages_tower: [
    "cursestaff",
    "firestaff",
    "froststaff",
    "arcanestaff",
    "holystaff",
    "naturestaff",
    "cloth_helmet",
    "cloth_armor",
    "cloth_shoes",
  ],
  toolmaker: ["tools", "gatherergear"],
  workbench: ["offhand", "cape", "bag"],
};

export const CRAFT_FINDER_ITEM_TYPE_LABELS_FR: Record<string, string> = {
  sword: "Épées",
  axe: "Haches",
  mace: "Masses",
  dagger: "Dagues",
  spear: "Lances",
  quarterstaff: "Bâtons de combat",
  hammer: "Marteaux",
  knuckles: "Gantelets de guerre",
  plate_helmet: "Casques de plaque",
  plate_armor: "Armures de plaque",
  plate_shoes: "Chaussures de plaque",
  bow: "Arcs",
  crossbow: "Arbalètes",
  leather_helmet: "Capuches de cuir",
  leather_armor: "Armures de cuir",
  leather_shoes: "Chaussures de cuir",
  cursestaff: "Bâtons maudits",
  firestaff: "Bâtons de feu",
  froststaff: "Bâtons de givre",
  arcanestaff: "Bâtons arcaniques",
  holystaff: "Bâtons sacrés",
  naturestaff: "Bâtons de nature",
  cloth_helmet: "Chapeaux de tissu",
  cloth_armor: "Robes de tissu",
  cloth_shoes: "Chaussures de tissu",
  tools: "Outils de récolte",
  gatherergear: "Tenues de récolteur",
  offhand: "Objets en main secondaire",
  cape: "Capes",
  bag: "Sacs",
};

// The 2 real Albion food/potion crafting buildings — Kitchen (food) and
// Alchemist's Lab (potions), confirmed by direct inspection of
// food-catalog.json's items (every one carries a uniform `@craftingcategory`
// of "food" or "potion", mapped 1:1 to these). Kept as a separate tuple from
// CRAFT_FINDER_WORKSHOPS above (rather than folded in) since they're a
// distinct building family with their own ingredient chain (crops/fish, not
// ore/wood/hide/fiber/rock) — see build-food-catalog.mjs and this file's
// CRAFTING_SPECIALTY_CITY_BY_CATEGORY below.
export const CRAFT_FINDER_FOOD_CATEGORIES = ["cooking", "alchemy"] as const;
export type CraftFinderFoodCategory = (typeof CRAFT_FINDER_FOOD_CATEGORIES)[number];

export const CRAFT_FINDER_FOOD_LABELS_FR: Record<CraftFinderFoodCategory, string> = {
  cooking: "Cuisine",
  alchemy: "Alchimie",
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
  ...CRAFT_FINDER_FOOD_CATEGORIES,
  ...CRAFT_FINDER_REFINING_CATEGORIES,
] as const;
export type CraftFinderNodeCategory = (typeof CRAFT_FINDER_NODE_CATEGORIES)[number];

export const CRAFT_FINDER_CATEGORY_LABELS_FR: Record<CraftFinderNodeCategory, string> = {
  ...CRAFT_FINDER_WORKSHOP_LABELS_FR,
  ...CRAFT_FINDER_FOOD_LABELS_FR,
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

// Default/effective Return Rate, derived from Albion's own "Local
// Production Bonus" system — confirmed against
// wiki.albiononline.com/wiki/Local_Production_Bonus and
// .../wiki/Resource_return_rate, cross-checked against the city bonus table
// the user linked (reddit.com/r/albiononline city refining/crafting bonuses
// post) and independently against albioncodex.com's own city-bonus guide
// (the two agree, and together they account for every single
// @craftingcategory value that actually appears in crafting-catalog.json —
// see the self-consistency note on CRAFTING_SPECIALTY_CITY_BY_CATEGORY
// below). Every city with actual crafting/refining stations (all 7 of
// CITIES except "Black Market", a trading-only hub) grants a flat +18
// production-bonus baseline to every category. On top of that:
//
// - Each of the 5 royal cities specializes in exactly one raw-resource
//   refining category (+40 bonus) — Caerleon and Brecilien have none. This
//   part IS whole-category (a city's refining specialty covers every tier
//   of that resource), so it's baked into the per-(city, category) table
//   default below.
// - A +15 crafting specialization also exists everywhere, but it targets
//   one specific weapon/armor/item type, not a whole workshop's catalog
//   (e.g. Martlock's crafting bonus is Axe only, not every Warrior's Forge
//   item) — too granular for the per-(city, workshop) table, so it's
//   applied separately, per item, at evaluation time (see
//   craftingSpecialtyBonusFor + effectiveReturnRateFor below) rather than
//   baked into the table default.
//
// A production-bonus percentage converts to an actual Return Rate via
// Albion's own formula: 1 - 1/(1 + bonus/100), and back via its inverse —
// used to compose the per-item +15 onto whatever Return Rate the user has
// already entered in the table (which may itself already reflect their own
// spec level, an active daily bonus, or Focus — the wiki documents Focus as
// a further flat +59 to the production bonus, all summed the same way
// before Albion does this same conversion once at the end). This is why
// composition happens in production-bonus space rather than by just adding
// 15 percentage points onto the Return Rate directly, which would
// under/overshoot except right at the +18 baseline.
const PRODUCTION_BONUS_BASE_PCT = 18;
const PRODUCTION_BONUS_REFINING_SPECIALTY_PCT = 40;
const PRODUCTION_BONUS_CRAFTING_SPECIALTY_PCT = 15;

export function productionBonusToReturnRate(bonusPct: number): number {
  return 1 - 1 / (1 + bonusPct / 100);
}

export function returnRateToProductionBonus(returnRate: number): number {
  const clamped = Math.max(0, Math.min(0.99, returnRate));
  return (1 / (1 - clamped) - 1) * 100;
}

const REFINING_SPECIALTY_BY_CITY: Partial<Record<string, CraftFinderRefiningCategory>> = {
  "Fort Sterling": "planks",
  Lymhurst: "cloth",
  Martlock: "leather",
  Bridgewatch: "stoneblock",
  Thetford: "metalbar",
};

export function defaultReturnRateForCity(city: string, category: CraftFinderNodeCategory): number {
  if (city === "Black Market") return 0;
  let bonus = PRODUCTION_BONUS_BASE_PCT;
  if (REFINING_SPECIALTY_BY_CITY[city] === category) bonus += PRODUCTION_BONUS_REFINING_SPECIALTY_PCT;
  return productionBonusToReturnRate(bonus);
}

// Which city gets the +15 crafting specialty for a given raw
// @craftingcategory value (CraftItem.craftingCategory) — every entry
// verified against crafting-catalog.json's actual distinct category values
// (30 of them, T1 gear excepted — see CraftItem.craftingCategory's own
// comment), and every one of those 30 is accounted for exactly once below,
// which is strong self-consistency evidence for a mechanic sourced from
// secondary guides rather than the wiki directly (wiki.albiononline.com
// 403s this codebase's fetcher — see PROJECT_STATUS.md). "offhand" alone
// covers every off-hand sub-type (shield/book/torch — there's no separate
// @craftingcategory per sub-type in the raw data), and "tools"/"gatherergear"
// together are the whole of Toolmaker, so those three read as "one
// craftingcategory = one whole building's worth" even though the mechanic
// itself is still item-type-based, not building-based. `food`/`potion`
// (Kitchen/Alchemist's Lab, added for Craft Finder's food/potion support)
// are genuinely whole-category matches, not an approximation — every food
// item shares the single `food` category and every potion the single
// `potion` category (see build-food-catalog.mjs), so Caerleon's "cooked
// food" specialty and Brecilien's "potion" specialty apply to their entire
// respective catalogs, unlike equipment's per-weapon-type granularity.
const CRAFTING_SPECIALTY_CITY_BY_CATEGORY: Record<string, string> = {
  // Fort Sterling
  spear: "Fort Sterling",
  hammer: "Fort Sterling",
  holystaff: "Fort Sterling",
  cloth_armor: "Fort Sterling",
  plate_helmet: "Fort Sterling",
  // Lymhurst
  sword: "Lymhurst",
  bow: "Lymhurst",
  arcanestaff: "Lymhurst",
  leather_helmet: "Lymhurst",
  leather_shoes: "Lymhurst",
  // Bridgewatch
  dagger: "Bridgewatch",
  plate_armor: "Bridgewatch",
  crossbow: "Bridgewatch",
  cursestaff: "Bridgewatch",
  cloth_shoes: "Bridgewatch",
  // Martlock
  axe: "Martlock",
  quarterstaff: "Martlock",
  plate_shoes: "Martlock",
  froststaff: "Martlock",
  offhand: "Martlock",
  // Thetford
  mace: "Thetford",
  leather_armor: "Thetford",
  firestaff: "Thetford",
  naturestaff: "Thetford",
  cloth_helmet: "Thetford",
  // Caerleon
  knuckles: "Caerleon",
  tools: "Caerleon",
  gatherergear: "Caerleon",
  food: "Caerleon",
  // Brecilien
  cape: "Brecilien",
  bag: "Brecilien",
  potion: "Brecilien",
};

export function craftingSpecialtyBonusPct(city: string, craftingCategory: string | null): number {
  if (!craftingCategory) return 0;
  return CRAFTING_SPECIALTY_CITY_BY_CATEGORY[craftingCategory] === city
    ? PRODUCTION_BONUS_CRAFTING_SPECIALTY_PCT
    : 0;
}

// Composes the item-specific +15 (if this exact item type is `city`'s
// crafting specialty) onto a base Return Rate already read from the
// per-(city, workshop) table — see this file's header comment for why this
// happens in production-bonus space rather than by adding percentage
// points directly to the Return Rate.
export function effectiveReturnRateFor(baseReturnRate: number, city: string, craftingCategory: string | null): number {
  const bonusPct = craftingSpecialtyBonusPct(city, craftingCategory);
  if (bonusPct === 0) return baseReturnRate;
  return productionBonusToReturnRate(returnRateToProductionBonus(baseReturnRate) + bonusPct);
}
