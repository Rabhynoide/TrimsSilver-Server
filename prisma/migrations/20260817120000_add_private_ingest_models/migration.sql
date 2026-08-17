-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('unknown', 'offer', 'request');

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" TEXT NOT NULL,
    "orderId" BIGINT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "itemTypeId" TEXT NOT NULL,
    "itemGroupTypeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qualityLevel" INTEGER NOT NULL,
    "enchantmentLevel" INTEGER NOT NULL,
    "unitPriceSilver" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "auctionType" "AuctionType" NOT NULL,
    "expires" TEXT NOT NULL,
    "contributeToPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareWithFriends" BOOLEAN NOT NULL DEFAULT false,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCount" (
    "id" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "locationId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "nonFlaggedCount" INTEGER,
    "flaggedCount" INTEGER,
    "isBz" BOOLEAN NOT NULL,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementSnapshot" (
    "id" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "characterName" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementEntry" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "snapshotId" TEXT NOT NULL,

    CONSTRAINT "AchievementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalMultiplier" (
    "id" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "submittedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivitySnapshot" (
    "id" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "submittedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivityEvent" (
    "id" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "uniqueName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "snapshotId" TEXT NOT NULL,

    CONSTRAINT "FestivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEstimatedMarketValue" (
    "id" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "itemUniqueName" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "emv" BIGINT NOT NULL,
    "blackMarketEmv" BIGINT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemEstimatedMarketValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateOrderShare" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "resolvedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateOrderShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MarketOrder_serverId_itemTypeId_locationId_idx" ON "MarketOrder"("serverId", "itemTypeId", "locationId");

-- CreateIndex
CREATE INDEX "MarketOrder_uploaderId_idx" ON "MarketOrder"("uploaderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOrder_serverId_orderId_key" ON "MarketOrder"("serverId", "orderId");

-- CreateIndex
CREATE INDEX "PlayerCount_serverId_locationId_observedAt_idx" ON "PlayerCount"("serverId", "locationId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementSnapshot_serverId_characterName_key" ON "AchievementSnapshot"("serverId", "characterName");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementEntry_snapshotId_achievementId_key" ON "AchievementEntry"("snapshotId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalMultiplier_serverId_key" ON "GlobalMultiplier"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "FestivitySnapshot_serverId_key" ON "FestivitySnapshot"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "FestivityEvent_snapshotId_category_uniqueName_startTime_key" ON "FestivityEvent"("snapshotId", "category", "uniqueName", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEstimatedMarketValue_serverId_itemUniqueName_quality_da_key" ON "ItemEstimatedMarketValue"("serverId", "itemUniqueName", "quality", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateOrderShare_ownerId_value_key" ON "PrivateOrderShare"("ownerId", "value");

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCount" ADD CONSTRAINT "PlayerCount_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSnapshot" ADD CONSTRAINT "AchievementSnapshot_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementEntry" ADD CONSTRAINT "AchievementEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AchievementSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalMultiplier" ADD CONSTRAINT "GlobalMultiplier_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivitySnapshot" ADD CONSTRAINT "FestivitySnapshot_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivityEvent" ADD CONSTRAINT "FestivityEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "FestivitySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEstimatedMarketValue" ADD CONSTRAINT "ItemEstimatedMarketValue_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateOrderShare" ADD CONSTRAINT "PrivateOrderShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateOrderShare" ADD CONSTRAINT "PrivateOrderShare_resolvedUserId_fkey" FOREIGN KEY ("resolvedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

