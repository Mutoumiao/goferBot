/*
  Warnings:

  - You are about to drop the column `embedding` on the `chunks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "chunks" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "parent_token_id" TEXT;

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_auth_methods" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,

    CONSTRAINT "application_auth_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_code_key" ON "applications"("code");

-- CreateIndex
CREATE INDEX "application_auth_methods_provider_idx" ON "application_auth_methods"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "application_auth_methods_application_id_provider_key" ON "application_auth_methods"("application_id", "provider");

-- AddForeignKey
ALTER TABLE "application_auth_methods" ADD CONSTRAINT "application_auth_methods_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
