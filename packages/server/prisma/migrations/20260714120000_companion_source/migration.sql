-- Companion dual-source: system (shared catalog) | user (owned)
-- Invariant (app-enforced): system ⇒ user_id IS NULL; user ⇒ user_id IS NOT NULL

CREATE TYPE "CompanionSource" AS ENUM ('system', 'user');

-- Add source with default so existing rows become user
ALTER TABLE "companions" ADD COLUMN "source" "CompanionSource" NOT NULL DEFAULT 'user';

-- Allow shared system companions without owner
ALTER TABLE "companions" ALTER COLUMN "user_id" DROP NOT NULL;

-- Backfill (explicit; default already covers)
UPDATE "companions" SET "source" = 'user' WHERE "source" IS NULL OR "source" = 'user';

CREATE INDEX "companions_source_status_idx" ON "companions"("source", "status");
