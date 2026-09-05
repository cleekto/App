-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "replyToId" UUID,
ADD COLUMN     "topicId" UUID;

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "colorToken" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "chat_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roomId" UUID,
    "conversationId" UUID,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_topics_roomId_updatedAt_idx" ON "chat_topics"("roomId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "chat_reads_companyId_userId_idx" ON "chat_reads"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_reads_userId_roomId_key" ON "chat_reads"("userId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_reads_userId_conversationId_key" ON "chat_reads"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "chat_messages_topicId_createdAt_idx" ON "chat_messages"("topicId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "chat_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Тема бывает только у сообщения в комнате. Личная переписка тем не имеет:
-- там и так один разговор, а тема без комнаты висела бы в воздухе.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_topic_only_in_room"
  CHECK ("topicId" IS NULL OR "roomId" IS NOT NULL);

-- Сообщение не отвечает само себе. Проверка дешёвая, а цикл в ленте ответов
-- разбирать потом дорого.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_not_self"
  CHECK ("replyToId" IS NULL OR "replyToId" <> "id");

-- Отметка прочитанного относится ровно к одному разговору: либо к комнате,
-- либо к переписке. Уникальные ключи выше по отдельности этого не требуют.
ALTER TABLE "chat_reads"
  ADD CONSTRAINT "chat_reads_room_xor_conversation"
  CHECK (("roomId" IS NULL) <> ("conversationId" IS NULL));
