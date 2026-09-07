-- AlterTable
ALTER TABLE "listing_observations" ADD COLUMN     "viewCount" INTEGER,
ADD COLUMN     "viewsCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "listing_observations_sellerKind_viewCount_idx" ON "listing_observations"("sellerKind", "viewCount");
