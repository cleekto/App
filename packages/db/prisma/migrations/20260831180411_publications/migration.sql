-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'filled', 'published', 'expired');

-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "publishProfileId" UUID NOT NULL,
    "source" "Source" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "formVersion" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "unfilledFields" JSONB,
    "filledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "confirmedByUserId" UUID,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publications_companyId_propertyId_idx" ON "publications"("companyId", "propertyId");

-- CreateIndex
CREATE INDEX "publications_companyId_source_externalId_idx" ON "publications"("companyId", "source", "externalId");

-- CreateIndex
CREATE INDEX "publications_companyId_externalUrl_idx" ON "publications"("companyId", "externalUrl");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_publishProfileId_fkey" FOREIGN KEY ("publishProfileId") REFERENCES "publish_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
