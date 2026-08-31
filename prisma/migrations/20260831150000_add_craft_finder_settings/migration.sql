-- CreateTable
CREATE TABLE "CraftFinderSettings" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftFinderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CraftFinderSettings_userId_key" ON "CraftFinderSettings"("userId");

-- AddForeignKey
ALTER TABLE "CraftFinderSettings" ADD CONSTRAINT "CraftFinderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

