/*
  Warnings:

  - The primary key for the `admin_audit_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `application_auth_methods` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `applications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `chunks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_care_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_care_plans` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_conversations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_memories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_message_feedbacks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companion_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `companions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `folders` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `group_chat_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `group_chat_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `group_chats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `knowledge_bases` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "application_auth_methods" DROP CONSTRAINT "application_auth_methods_application_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chunks" DROP CONSTRAINT "chunks_document_id_fkey";

-- DropForeignKey
ALTER TABLE "chunks" DROP CONSTRAINT "chunks_kb_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_care_events" DROP CONSTRAINT "companion_care_events_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_care_events" DROP CONSTRAINT "companion_care_events_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_care_events" DROP CONSTRAINT "companion_care_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_care_plans" DROP CONSTRAINT "companion_care_plans_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_care_plans" DROP CONSTRAINT "companion_care_plans_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_conversations" DROP CONSTRAINT "companion_conversations_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_conversations" DROP CONSTRAINT "companion_conversations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_memories" DROP CONSTRAINT "companion_memories_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_memories" DROP CONSTRAINT "companion_memories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_message_feedbacks" DROP CONSTRAINT "companion_message_feedbacks_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_message_feedbacks" DROP CONSTRAINT "companion_message_feedbacks_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_message_feedbacks" DROP CONSTRAINT "companion_message_feedbacks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_messages" DROP CONSTRAINT "companion_messages_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_messages" DROP CONSTRAINT "companion_messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "companion_messages" DROP CONSTRAINT "companion_messages_user_id_fkey";

-- DropForeignKey
ALTER TABLE "companions" DROP CONSTRAINT "companions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_kb_id_fkey";

-- DropForeignKey
ALTER TABLE "folders" DROP CONSTRAINT "folders_kb_id_fkey";

-- DropForeignKey
ALTER TABLE "folders" DROP CONSTRAINT "folders_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chat_members" DROP CONSTRAINT "group_chat_members_companion_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chat_members" DROP CONSTRAINT "group_chat_members_group_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chat_members" DROP CONSTRAINT "group_chat_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chat_messages" DROP CONSTRAINT "group_chat_messages_group_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chat_messages" DROP CONSTRAINT "group_chat_messages_user_id_fkey";

-- DropForeignKey
ALTER TABLE "group_chats" DROP CONSTRAINT "group_chats_user_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_bases" DROP CONSTRAINT "knowledge_bases_user_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_session_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "settings" DROP CONSTRAINT "settings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropIndex
DROP INDEX "chunks_document_id_idx";

-- DropIndex
DROP INDEX "chunks_kb_id_idx";

-- DropIndex
DROP INDEX "documents_folder_id_idx";

-- DropIndex
DROP INDEX "documents_kb_id_idx";

-- DropIndex
DROP INDEX "folders_kb_id_idx";

-- DropIndex
DROP INDEX "knowledge_bases_user_id_idx";

-- DropIndex
DROP INDEX "messages_session_id_idx";

-- DropIndex
DROP INDEX "sessions_user_id_idx";

-- DropIndex
DROP INDEX "settings_user_id_idx";

-- AlterTable
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "admin_audit_logs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "application_auth_methods" DROP CONSTRAINT "application_auth_methods_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "application_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "application_auth_methods_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "applications" DROP CONSTRAINT "applications_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "auth_sessions" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "chunks" DROP CONSTRAINT "chunks_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "document_id" SET DATA TYPE TEXT,
ALTER COLUMN "kb_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "chunks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_care_events" DROP CONSTRAINT "companion_care_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ALTER COLUMN "care_plan_id" SET DATA TYPE TEXT,
ALTER COLUMN "conversation_id" SET DATA TYPE TEXT,
ALTER COLUMN "message_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_care_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_care_plans" DROP CONSTRAINT "companion_care_plans_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_care_plans_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_conversations" DROP CONSTRAINT "companion_conversations_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_conversations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_memories" DROP CONSTRAINT "companion_memories_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ALTER COLUMN "source_message_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_memories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_message_feedbacks" DROP CONSTRAINT "companion_message_feedbacks_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ALTER COLUMN "conversation_id" SET DATA TYPE TEXT,
ALTER COLUMN "message_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_message_feedbacks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companion_messages" DROP CONSTRAINT "companion_messages_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "conversation_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companion_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companions" DROP CONSTRAINT "companions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "companions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" DROP CONSTRAINT "documents_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "kb_id" SET DATA TYPE TEXT,
ALTER COLUMN "folder_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "folders" DROP CONSTRAINT "folders_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "kb_id" SET DATA TYPE TEXT,
ALTER COLUMN "parent_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "group_chat_members" DROP CONSTRAINT "group_chat_members_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "group_chat_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "group_chat_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "group_chat_messages" DROP CONSTRAINT "group_chat_messages_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "group_chat_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "companion_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "group_chat_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "group_chats" DROP CONSTRAINT "group_chats_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "group_chats_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "knowledge_bases" DROP CONSTRAINT "knowledge_bases_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "session_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'menu',
    "resource" TEXT,
    "parent_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_role_code_app_idx" ON "role_permissions"("role_code", "app");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_code_permission_id_app_key" ON "role_permissions"("role_code", "permission_id", "app");

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companions" ADD CONSTRAINT "companions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_conversations" ADD CONSTRAINT "companion_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_conversations" ADD CONSTRAINT "companion_conversations_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_memories" ADD CONSTRAINT "companion_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_memories" ADD CONSTRAINT "companion_memories_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_care_plans" ADD CONSTRAINT "companion_care_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_care_plans" ADD CONSTRAINT "companion_care_plans_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chats" ADD CONSTRAINT "group_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chat_messages" ADD CONSTRAINT "group_chat_messages_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_chat_messages" ADD CONSTRAINT "group_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_auth_methods" ADD CONSTRAINT "application_auth_methods_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
