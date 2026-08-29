-- CreateTable
CREATE TABLE "JournalsCalculatorSettings" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalsCalculatorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalsCalculatorSettings_userId_key" ON "JournalsCalculatorSettings"("userId");

-- AddForeignKey
ALTER TABLE "JournalsCalculatorSettings" ADD CONSTRAINT "JournalsCalculatorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
