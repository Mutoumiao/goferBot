-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
