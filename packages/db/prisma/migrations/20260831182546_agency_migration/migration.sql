-- CreateEnum
CREATE TYPE "MigrationBatchStatus" AS ENUM ('draft', 'previewed', 'applied', 'rolled_back');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "migrationBatchId" UUID;

-- CreateTable
CREATE TABLE "column_mapping_schemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "column_mapping_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mappingSchemaId" UUID,
    "status" "MigrationBatchStatus" NOT NULL DEFAULT 'draft',
    "detectedColumns" TEXT[],
    "rawRows" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER,
    "rejectedRows" INTEGER,
    "report" JSONB,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "migration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "column_mapping_schemas_companyId_idx" ON "column_mapping_schemas"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "column_mapping_schemas_companyId_name_key" ON "column_mapping_schemas"("companyId", "name");

-- CreateIndex
CREATE INDEX "migration_batches_companyId_createdAt_idx" ON "migration_batches"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "properties_companyId_origin_idx" ON "properties"("companyId", "origin");

-- CreateIndex
CREATE INDEX "properties_migrationBatchId_idx" ON "properties"("migrationBatchId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "migration_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "column_mapping_schemas" ADD CONSTRAINT "column_mapping_schemas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_batches" ADD CONSTRAINT "migration_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_batches" ADD CONSTRAINT "migration_batches_mappingSchemaId_fkey" FOREIGN KEY ("mappingSchemaId") REFERENCES "column_mapping_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
