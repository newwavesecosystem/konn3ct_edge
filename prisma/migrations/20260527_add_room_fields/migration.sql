-- Migration: add_room_fields
-- Adds: mode, recordingSetting, guestJoinAllowed, accessPin to the Room table
-- Run against the production PostgreSQL DB with: prisma migrate deploy

ALTER TABLE "Room" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'meeting';
ALTER TABLE "Room" ADD COLUMN "recordingSetting" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "Room" ADD COLUMN "guestJoinAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Room" ADD COLUMN "accessPin" TEXT;
