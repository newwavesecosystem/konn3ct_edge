-- AlterTable Recording
ALTER TABLE "Recording" ADD COLUMN "duration" INTEGER,
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'processing';

-- AlterTable Room
ALTER TABLE "Room" ADD COLUMN "isWaitingRoomEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "maxActiveCameras" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "maxParticipants" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "maxWebinarAudience" INTEGER NOT NULL DEFAULT 1000;

-- AlterTable PaymentTransaction
ALTER TABLE "PaymentTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "roomId" TEXT;

-- CreateTable ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "targetUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable MeetingPoll
CREATE TABLE "MeetingPoll" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable SharedNote
CREATE TABLE "SharedNote" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable LiveStream
CREATE TABLE "LiveStream" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "rtmpUrls" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ChatMessage_roomId_idx
CREATE INDEX "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");

-- CreateIndex MeetingPoll_roomId_idx
CREATE INDEX "MeetingPoll_roomId_idx" ON "MeetingPoll"("roomId");

-- CreateIndex SharedNote_roomId_key
CREATE UNIQUE INDEX "SharedNote_roomId_key" ON "SharedNote"("roomId");

-- CreateIndex LiveStream_roomId_idx
CREATE INDEX "LiveStream_roomId_idx" ON "LiveStream"("roomId");

-- CreateIndex PaymentTransaction_roomId_idx
CREATE INDEX "PaymentTransaction_roomId_idx" ON "PaymentTransaction"("roomId");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MeetingPoll" ADD CONSTRAINT "MeetingPoll_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SharedNote" ADD CONSTRAINT "SharedNote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
