-- CreateTable
CREATE TABLE "FarmingCalculatorSettings" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmingCalculatorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmingCalculatorSettings_userId_key" ON "FarmingCalculatorSettings"("userId");

-- AddForeignKey
ALTER TABLE "FarmingCalculatorSettings" ADD CONSTRAINT "FarmingCalculatorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

