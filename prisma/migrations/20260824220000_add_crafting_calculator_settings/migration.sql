-- CreateTable
CREATE TABLE "CraftingCalculatorSettings" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftingCalculatorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CraftingCalculatorSettings_userId_key" ON "CraftingCalculatorSettings"("userId");

-- AddForeignKey
ALTER TABLE "CraftingCalculatorSettings" ADD CONSTRAINT "CraftingCalculatorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
