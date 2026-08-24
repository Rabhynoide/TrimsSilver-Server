// Unlike farming-constants.ts, this file deliberately does NOT hardcode a
// Resource Return Rate table or a city->bonus-category mapping: the wiki
// (Crafting, Refining, Crafting_Focus, Cities pages, checked while building
// this feature) documents pieces of the mechanic (Focus reduces cost, a 2020
// patch note mentions Caerleon's crafting bonus is +15% to specific
// categories) but not a clean, current, per-category Return Rate percentage
// table the way Farming's location-bonus table was. Rather than hardcode
// unverified numbers, the Crafting Calculator takes Return Rate and the
// "station bonus applies" flag as plain user inputs (see crafting/types.ts).
// See src/data/market-constants.ts for the shared sales tax / setup fee
// constants this file's consumers (calc.ts) reuse.

// Deliberately 0, not a guessed "typical" percentage — see file header. The
// user reads their actual Return Rate off the in-game crafting window and
// types it in; defaulting to an unverified number would be worse than
// defaulting to off.
export const DEFAULT_RETURN_RATE = 0;
