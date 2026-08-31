-- CreateEnum
CREATE TYPE "Source" AS ENUM ('SS_GE', 'MYHOME_GE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PropertyOrigin" AS ENUM ('consent', 'manual', 'legacy_import');

-- CreateEnum
CREATE TYPE "ListingLifecycle" AS ENUM ('active', 'stale', 'removed');

-- CreateEnum
CREATE TYPE "ObservationStateValue" AS ENUM ('new', 'skipped', 'refused', 'no_answer', 'callback', 'converted');

-- CreateTable
CREATE TABLE "property_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "fullName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_contact_phones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerContactId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_contact_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "assignedUserId" UUID,
    "propertyLinkId" UUID,
    "pipelineStatusId" UUID NOT NULL,
    "origin" "PropertyOrigin" NOT NULL,
    "originAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerContactId" UUID,
    "transactionType" "TransactionType" NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "rooms" INTEGER,
    "areaTotal" DECIMAL(10,2),
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "district" TEXT,
    "addressRaw" TEXT,
    "addressNormalized" TEXT,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "descriptionSource" TEXT,
    "publicDescription" TEXT,
    "photos" TEXT[],
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "propertyId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "source" "Source" NOT NULL,
    "externalId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "lifecycle" "ListingLifecycle" NOT NULL DEFAULT 'active',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT NOT NULL,
    "missingFields" TEXT[],
    "importedByUserId" UUID,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_listing_price_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceListingId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_listing_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" "Source" NOT NULL,
    "externalId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "area" DECIMAL(10,2),
    "rooms" INTEGER,
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "district" TEXT,
    "propertyType" "PropertyType",
    "transactionType" "TransactionType",
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "phoneNormalized" TEXT,
    "isAgencyGuess" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPriceChangeAt" TIMESTAMP(3),

    CONSTRAINT "listing_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_price_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "observationId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "observationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "state" "ObservationStateValue" NOT NULL DEFAULT 'new',
    "callbackAt" TIMESTAMP(3),
    "note" TEXT,
    "doNotCallCompanyWide" BOOLEAN NOT NULL DEFAULT false,
    "convertedPropertyId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observation_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_links_companyId_idx" ON "property_links"("companyId");

-- CreateIndex
CREATE INDEX "owner_contacts_companyId_idx" ON "owner_contacts"("companyId");

-- CreateIndex
CREATE INDEX "owner_contact_phones_companyId_phoneNormalized_idx" ON "owner_contact_phones"("companyId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "owner_contact_phones_ownerContactId_idx" ON "owner_contact_phones"("ownerContactId");

-- CreateIndex
CREATE INDEX "properties_companyId_teamId_pipelineStatusId_idx" ON "properties"("companyId", "teamId", "pipelineStatusId");

-- CreateIndex
CREATE INDEX "properties_companyId_teamId_updatedAt_idx" ON "properties"("companyId", "teamId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "properties_companyId_propertyLinkId_idx" ON "properties"("companyId", "propertyLinkId");

-- CreateIndex
CREATE INDEX "properties_companyId_teamId_ownerContactId_idx" ON "properties"("companyId", "teamId", "ownerContactId");

-- CreateIndex
CREATE INDEX "source_listings_propertyId_idx" ON "source_listings"("propertyId");

-- CreateIndex
CREATE INDEX "source_listings_companyId_canonicalUrl_idx" ON "source_listings"("companyId", "canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "source_listings_teamId_source_externalId_key" ON "source_listings"("teamId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "source_listings_teamId_source_canonicalUrl_key" ON "source_listings"("teamId", "source", "canonicalUrl");

-- CreateIndex
CREATE INDEX "source_listing_price_history_sourceListingId_changedAt_idx" ON "source_listing_price_history"("sourceListingId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "listing_observations_district_rooms_area_idx" ON "listing_observations"("district", "rooms", "area");

-- CreateIndex
CREATE INDEX "listing_observations_phoneNormalized_idx" ON "listing_observations"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "listing_observations_source_externalId_key" ON "listing_observations"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_observations_source_canonicalUrl_key" ON "listing_observations"("source", "canonicalUrl");

-- CreateIndex
CREATE INDEX "observation_price_history_observationId_observedAt_idx" ON "observation_price_history"("observationId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "observation_states_companyId_teamId_state_idx" ON "observation_states"("companyId", "teamId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "observation_states_observationId_teamId_key" ON "observation_states"("observationId", "teamId");

-- AddForeignKey
ALTER TABLE "property_links" ADD CONSTRAINT "property_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_contacts" ADD CONSTRAINT "owner_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_contact_phones" ADD CONSTRAINT "owner_contact_phones_ownerContactId_fkey" FOREIGN KEY ("ownerContactId") REFERENCES "owner_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_pipelineStatusId_fkey" FOREIGN KEY ("pipelineStatusId") REFERENCES "pipeline_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerContactId_fkey" FOREIGN KEY ("ownerContactId") REFERENCES "owner_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_propertyLinkId_fkey" FOREIGN KEY ("propertyLinkId") REFERENCES "property_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_listings" ADD CONSTRAINT "source_listings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_listing_price_history" ADD CONSTRAINT "source_listing_price_history_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES "source_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_price_history" ADD CONSTRAINT "observation_price_history_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "listing_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_states" ADD CONSTRAINT "observation_states_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "listing_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_states" ADD CONSTRAINT "observation_states_convertedPropertyId_fkey" FOREIGN KEY ("convertedPropertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
