-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "messageId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_attachments_messageId_idx" ON "chat_attachments"("messageId");

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Пустой файл и файл отрицательного размера — не файлы, а признак того,
-- что размер приехал не оттуда. База отказывает сразу: разбираться потом,
-- почему у вложения ноль байт, дороже.
ALTER TABLE "chat_attachments"
  ADD CONSTRAINT "chat_attachments_size_positive" CHECK ("sizeBytes" > 0);

-- Имя обязано быть непустым: по нему вложение и узнают. Пустое имя
-- показалось бы пустой строкой, и открыть его человек не решился бы.
ALTER TABLE "chat_attachments"
  ADD CONSTRAINT "chat_attachments_name_not_blank" CHECK (length(btrim("fileName")) > 0);
