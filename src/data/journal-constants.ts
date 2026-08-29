// Journal family metadata — display names and naming-scheme mapping straight
// from wiki.albiononline.com/wiki/Journal ("Gathering Journals follow a
// specific naming scheme based on the name of the laborer", + the Crafting/
// Mercenary/General sections). The 19 families below are exhaustive — they
// match the 19 distinct `T{tier}_JOURNAL_*` suffixes found across all 133
// rows of items.json's journalitem bucket (7 tiers × 19 families = 133).
export type JournalFamily =
  | "WOOD"
  | "STONE"
  | "ORE"
  | "FIBER"
  | "HIDE"
  | "FISHING"
  | "HUNTER"
  | "MAGE"
  | "WARRIOR"
  | "TOOLMAKER"
  | "MERCENARY"
  | "TROPHY_WOOD"
  | "TROPHY_STONE"
  | "TROPHY_ORE"
  | "TROPHY_FIBER"
  | "TROPHY_HIDE"
  | "TROPHY_FISHING"
  | "TROPHY_GENERAL"
  | "TROPHY_MERCENARY";

// "gathering": fully modeled — fill cost auto-computed from market prices via
// the catalog's fillOptions (see build-journal-catalog.mjs).
// "manual-fill": delivery/reward side is fully modeled from real game data
// same as gathering, but the "Buy Empty, ..." fill cost isn't derivable from
// a market price (crafting fame per equipment item, PvE kill fame, or "any"
// fame source aren't in the data) — the UI asks for it as a manual number.
export type JournalKind = "gathering" | "manual-fill";

// Profession words verified directly against localization.json's FR-FR
// segs for each family's T2 "_EMPTY" tuid (e.g. @ITEMS_T2_JOURNAL_WOOD_EMPTY
// -> "Registre de l'apprenti bûcheron (vide)"), so these match the real
// in-game French client rather than being freehand translations.
export const JOURNAL_FAMILIES: Record<JournalFamily, { label: string; kind: JournalKind }> = {
  WOOD: { label: "Registre du Bûcheron", kind: "gathering" },
  STONE: { label: "Registre du Tailleur de pierre", kind: "gathering" },
  ORE: { label: "Registre du Chercheur", kind: "gathering" },
  FIBER: { label: "Registre du Moissonneur", kind: "gathering" },
  HIDE: { label: "Registre du Garde-forestier", kind: "gathering" },
  FISHING: { label: "Registre du Pêcheur", kind: "manual-fill" },
  HUNTER: { label: "Registre de l'Archer", kind: "manual-fill" },
  MAGE: { label: "Registre de l'Imprégnateur", kind: "manual-fill" },
  WARRIOR: { label: "Registre du Forgeron", kind: "manual-fill" },
  TOOLMAKER: { label: "Registre du Bricoleur", kind: "manual-fill" },
  MERCENARY: { label: "Registre du Mercenaire", kind: "manual-fill" },
  TROPHY_WOOD: { label: "Registre de Trophée du Bûcheron", kind: "gathering" },
  TROPHY_STONE: { label: "Registre de Trophée du Tailleur de pierre", kind: "gathering" },
  TROPHY_ORE: { label: "Registre de Trophée du Chercheur", kind: "gathering" },
  TROPHY_FIBER: { label: "Registre de Trophée du Moissonneur", kind: "gathering" },
  TROPHY_HIDE: { label: "Registre de Trophée du Garde-forestier", kind: "gathering" },
  TROPHY_FISHING: { label: "Registre de Trophée du Pêcheur", kind: "manual-fill" },
  TROPHY_GENERAL: { label: "Registre de Trophée du Généraliste", kind: "manual-fill" },
  TROPHY_MERCENARY: { label: "Registre de Trophée du Mercenaire", kind: "manual-fill" },
};

export const JOURNAL_FAMILY_ORDER: JournalFamily[] = [
  "WOOD",
  "STONE",
  "ORE",
  "FIBER",
  "HIDE",
  "WARRIOR",
  "HUNTER",
  "MAGE",
  "TOOLMAKER",
  "MERCENARY",
  "FISHING",
  "TROPHY_GENERAL",
  "TROPHY_MERCENARY",
  "TROPHY_HIDE",
  "TROPHY_WOOD",
  "TROPHY_STONE",
  "TROPHY_ORE",
  "TROPHY_FIBER",
  "TROPHY_FISHING",
];

export const JOURNAL_TIERS = [2, 3, 4, 5, 6, 7, 8] as const;

// Enchantment distribution for journal delivery rewards, per
// wiki.albiononline.com/wiki/Journal — same for Gathering and Crafting
// journals. Not actually needed by the calculator (the catalog's own
// lootlist weights already encode this per-tier, straight from game data),
// kept here only as the documented cross-check the loot weights were
// verified against.
export const ENCHANT_DISTRIBUTION = { 0: 0.9445, 1: 0.05, 2: 0.005, 3: 0.0005 } as const;

// AODP addresses a journal's "Full" (filled) state with a "_FULL" suffix on
// top of the base (Empty) uniqueName — confirmed against AFM's own
// /pricecheck/T8_JOURNAL_WOOD_FULL link. This is a state tag, not a separate
// item definition in ao-bin-dumps (no "_FULL" entries exist in items.json at
// all — unlike enchant/quality, which are real distinct game items).
export function journalMarketId(uniqueName: string, state: "empty" | "full"): string {
  return state === "full" ? `${uniqueName}_FULL` : uniqueName;
}

// Enchanted resources (loot rewards and fill-in materials, e.g. wood/planks/
// ore/metal bar/fiber/cloth/hide/leather/rock) are each their own standalone
// game item named "UNIQUENAME_LEVELN" (see build-item-catalog.mjs) — but
// AODP still expects an "@N" appended on top of that for price queries, i.e.
// "UNIQUENAME_LEVELN@N", same convention already used by
// market-prices/types.ts's itemId(). journal-catalog.json's loot/fillOptions
// entries store the bare "_LEVELN" id (straight from the game's own lootlist/
// validitem data), so this needs to be applied wherever that id is used to
// fetch or look up a price — confirmed live: AODP has real data under
// "T4_PLANKS_LEVEL1@1" while "T4_PLANKS_LEVEL1" alone returns nothing.
const RESOURCE_LEVEL_SUFFIX = /_LEVEL(\d)$/;
export function resourceMarketId(uniqueName: string): string {
  const match = uniqueName.match(RESOURCE_LEVEL_SUFFIX);
  return match ? `${uniqueName}@${match[1]}` : uniqueName;
}
