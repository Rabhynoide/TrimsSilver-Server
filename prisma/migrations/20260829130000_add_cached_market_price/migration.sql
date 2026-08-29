-- CreateTable
CREATE TABLE "CachedMarketPrice" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "sellPriceMin" INTEGER NOT NULL,
    "sellPriceMinDate" TEXT NOT NULL,
    "sellPriceMax" INTEGER NOT NULL,
    "sellPriceMaxDate" TEXT NOT NULL,
    "buyPriceMin" INTEGER NOT NULL,
    "buyPriceMinDate" TEXT NOT NULL,
    "buyPriceMax" INTEGER NOT NULL,
    "buyPriceMaxDate" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedMarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CachedMarketPrice_region_idx" ON "CachedMarketPrice"("region");

-- CreateIndex
CREATE UNIQUE INDEX "CachedMarketPrice_itemId_city_quality_region_key" ON "CachedMarketPrice"("itemId", "city", "quality", "region");
