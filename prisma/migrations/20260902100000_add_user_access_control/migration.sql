-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasFullAccess" BOOLEAN NOT NULL DEFAULT false;
