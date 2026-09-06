-- CreateTable
CREATE TABLE "chat_room_watches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_room_watches_userId_idx" ON "chat_room_watches"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_watches_roomId_userId_key" ON "chat_room_watches"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "chat_room_watches" ADD CONSTRAINT "chat_room_watches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_watches" ADD CONSTRAINT "chat_room_watches_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_watches" ADD CONSTRAINT "chat_room_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
