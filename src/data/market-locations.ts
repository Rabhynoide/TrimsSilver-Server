// The 8 in-game market locations, addressed by the numeric ids the game's
// Photon responses actually use (confirmed against the live
// https://cdn.albionfreemarket.com/ao-bin-dumps/formatted/world.json and
// TrimsSilver-Client's AlbionLocations.cs, which is the only place this table
// previously existed — TrimsSilver-Server had no server-side copy). The
// client uploads `locationId` raw/unnormalized (see
// AuctionGetOffersResponseHandler.cs etc.), so the server has to do its own
// resolution rather than trusting a pre-normalized value.
//
// Black Market is its own market location (id "3003") distinct from Caerleon
// city market ("3005") — note the raw world.json data mislabels 3003's
// UniqueName as "Caerleon" too (a legacy game-data quirk the client patches
// around), which is not a bug in this table.
export type MarketLocation = { id: string; city: string; isBlackMarket: boolean };

export const MARKET_LOCATIONS: MarketLocation[] = [
  { id: "7", city: "Thetford", isBlackMarket: false },
  { id: "1002", city: "Lymhurst", isBlackMarket: false },
  { id: "2004", city: "Bridgewatch", isBlackMarket: false },
  { id: "3003", city: "Black Market", isBlackMarket: true },
  { id: "3005", city: "Caerleon", isBlackMarket: false },
  { id: "3008", city: "Martlock", isBlackMarket: false },
  { id: "4002", city: "Fort Sterling", isBlackMarket: false },
  { id: "5003", city: "Brecilien", isBlackMarket: false },
];

const BY_ID = new Map(MARKET_LOCATIONS.map((l) => [l.id, l]));

export const BLACK_MARKET_LOCATION_ID = "3003";

export type ResolvedLocation = { id: string; city: string | null; isBlackMarket: boolean };

// Black Market entrances scattered across red-zone hideouts/HellDens report
// their own raw location strings (seen client-side as `BLACKBANK-<id>` /
// `<id>-HellDen` prefixes/suffixes, or the literal tokens `BLACK_MARKET` /
// `BLACKMARKET`) rather than the canonical "3003" — this doesn't attempt the
// client's full ResolveMarketLocationId candidate table (unverified against
// live upload data, see PROJECT_STATUS.md follow-up), just the common cases.
// Anything else is returned unresolved (city: null) rather than dropped, so
// it still shows up in the UI, just without a friendly name.
export function resolveLocation(rawLocationId: string): ResolvedLocation {
  const direct = BY_ID.get(rawLocationId);
  if (direct) return direct;

  const upper = rawLocationId.toUpperCase();
  if (upper === "BLACK_MARKET" || upper === "BLACKMARKET" || /^BLACKBANK-/.test(upper) || /-HELLDEN$/.test(upper)) {
    return { id: BLACK_MARKET_LOCATION_ID, city: "Black Market", isBlackMarket: true };
  }

  return { id: rawLocationId, city: null, isBlackMarket: false };
}
