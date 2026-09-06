-- AlterTable
ALTER TABLE "listing_observations" ADD COLUMN     "sellerKind" "SellerKind";

-- CreateIndex
CREATE INDEX "listing_observations_sellerKind_lastSeenAt_idx" ON "listing_observations"("sellerKind", "lastSeenAt" DESC);
