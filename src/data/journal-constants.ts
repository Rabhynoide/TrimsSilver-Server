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

export const JOURNAL_FAMILIES: Record<JournalFamily, { label: string; kind: JournalKind }> = {
  WOOD: { label: "Lumberjack's Journal", kind: "gathering" },
  STONE: { label: "Stonecutter's Journal", kind: "gathering" },
  ORE: { label: "Prospector's Journal", kind: "gathering" },
  FIBER: { label: "Cropper's Journal", kind: "gathering" },
  HIDE: { label: "Gamekeeper's Journal", kind: "gathering" },
  FISHING: { label: "Fisherman's Journal", kind: "manual-fill" },
  HUNTER: { label: "Fletcher's Journal", kind: "manual-fill" },
  MAGE: { label: "Imbuer's Journal", kind: "manual-fill" },
  WARRIOR: { label: "Blacksmith's Journal", kind: "manual-fill" },
  TOOLMAKER: { label: "Tinker's Journal", kind: "manual-fill" },
  MERCENARY: { label: "Mercenary's Journal", kind: "manual-fill" },
  TROPHY_WOOD: { label: "Lumberjack's Trophy Journal", kind: "gathering" },
  TROPHY_STONE: { label: "Stonecutter's Trophy Journal", kind: "gathering" },
  TROPHY_ORE: { label: "Prospector's Trophy Journal", kind: "gathering" },
  TROPHY_FIBER: { label: "Cropper's Trophy Journal", kind: "gathering" },
  TROPHY_HIDE: { label: "Gamekeeper's Trophy Journal", kind: "gathering" },
  TROPHY_FISHING: { label: "Fisherman's Trophy Journal", kind: "manual-fill" },
  TROPHY_GENERAL: { label: "Generalist Trophy Journal", kind: "manual-fill" },
  TROPHY_MERCENARY: { label: "Mercenary's Trophy Journal", kind: "manual-fill" },
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
