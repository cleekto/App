-- CreateIndex
CREATE INDEX "properties_addressNormalized_idx" ON "properties" USING GIN ("addressNormalized" gin_trgm_ops);
