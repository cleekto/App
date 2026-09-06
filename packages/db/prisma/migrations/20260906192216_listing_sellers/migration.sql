-- CreateEnum
CREATE TYPE "SellerResolution" AS ENUM ('search', 'listing', 'volume');

-- AlterTable
ALTER TABLE "listing_observations" ADD COLUMN     "sellerId" UUID;

-- CreateTable
CREATE TABLE "listing_sellers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" "Source" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "entityType" "SellerKind",
    "resolvedFrom" "SellerResolution",
    "listingsSeen" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_sellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_sellers_entityType_idx" ON "listing_sellers"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "listing_sellers_source_externalUserId_key" ON "listing_sellers"("source", "externalUserId");

-- AddForeignKey
ALTER TABLE "listing_observations" ADD CONSTRAINT "listing_observations_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "listing_sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
