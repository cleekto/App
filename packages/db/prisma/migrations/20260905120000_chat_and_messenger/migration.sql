-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "roomId" UUID,
    "conversationId" UUID,
    "authorUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_rooms_companyId_isArchived_updatedAt_idx" ON "chat_rooms"("companyId", "isArchived", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "direct_conversations_companyId_updatedAt_idx" ON "direct_conversations"("companyId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "direct_conversations_companyId_userAId_userBId_key" ON "direct_conversations"("companyId", "userAId", "userBId");

-- CreateIndex
CREATE INDEX "chat_messages_roomId_createdAt_idx" ON "chat_messages"("roomId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_companyId_authorUserId_idx" ON "chat_messages"("companyId", "authorUserId");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Сообщение принадлежит ЛИБО комнате, ЛИБО личной переписке, и никогда
-- обоим сразу. Условие держит база, а не только сценарий: состояние
-- «сообщение и в комнате, и в переписке» не должно существовать в принципе,
-- а забыть проверку в одном из путей записи — вопрос времени.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_room_xor_conversation"
  CHECK (("roomId" IS NULL) <> ("conversationId" IS NULL));

-- Пара в переписке нормализована: меньший идентификатор всегда первым.
-- Без этого одни и те же двое завели бы две переписки — по одной на того,
-- кто написал первым, — и половина сообщений оказалась бы «в другой».
ALTER TABLE "direct_conversations"
  ADD CONSTRAINT "direct_conversations_pair_ordered"
  CHECK ("userAId" < "userBId");
