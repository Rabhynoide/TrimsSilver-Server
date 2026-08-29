// Starts the market-price cache's background sync job once per server
// instance — see src/lib/priceCacheSync.ts. Node-only: this module imports
// the Prisma client (via priceCacheSync -> lib/prisma), which needs the
// Node runtime, not Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPriceCacheSync } = await import("./lib/priceCacheSync");
    startPriceCacheSync();
  }
}
