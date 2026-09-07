-- AlterTable
ALTER TABLE "listing_observations" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "listing_observations_publishedAt_idx" ON "listing_observations"("publishedAt" DESC);
