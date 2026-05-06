-- CreateTable
CREATE TABLE "DialInNumber" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DialInNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallDetailRecord" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallDetailRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DialInNumber_number_key" ON "DialInNumber"("number");

-- CreateIndex
CREATE INDEX "CallDetailRecord_roomId_idx" ON "CallDetailRecord"("roomId");

-- AddForeignKey
ALTER TABLE "CallDetailRecord" ADD CONSTRAINT "CallDetailRecord_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
