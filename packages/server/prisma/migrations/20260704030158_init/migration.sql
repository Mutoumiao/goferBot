-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'chunking', 'embedding', 'indexing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "CompanionStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ConversationMessageStatus" AS ENUM ('completed', 'failed');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('preference', 'boundary', 'relationship_goal', 'conversation_style', 'important_fact');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('positive', 'negative');

-- CreateEnum
CREATE TYPE "CareFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'custom');

-- CreateEnum
CREATE TYPE "CareStatus" AS ENUM ('pending', 'sent', 'read', 'failed');

-- CreateEnum
CREATE TYPE "GroupMemberStatus" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('user', 'agent');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "password" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invitation_code_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SERIAL NOT NULL,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "name" TEXT NOT NULL,
    "ext" TEXT,
    "mime_type" TEXT,
    "size" BIGINT,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "error_message" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "chunk_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "provider" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "personality" TEXT,
    "tone" TEXT,
    "boundaries" TEXT,
    "guardrails_prompt" TEXT,
    "default_prompt" TEXT,
    "avatar_key" TEXT,
    "background_story" TEXT,
    "opening_message" TEXT,
    "visibility" TEXT,
    "status" "CompanionStatus" NOT NULL DEFAULT 'draft',
    "last_assistant_message" TEXT,
    "last_assistant_message_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "title" TEXT,
    "summary" VARCHAR(1600),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ConversationMessageStatus" NOT NULL DEFAULT 'completed',
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "status" "MemoryStatus" NOT NULL DEFAULT 'active',
    "source_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_message_feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_message_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_care_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "CareFrequency" NOT NULL,
    "preferred_time" TEXT,
    "scenes_json" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "custom_prompt" TEXT,
    "next_run_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_care_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "care_plan_id" TEXT,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "status" "CareStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "metadata_json" TEXT,
    "generated_at_ms" BIGINT NOT NULL,
    "read_at_ms" BIGINT,

    CONSTRAINT "companion_care_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_chats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_chat_members" (
    "id" TEXT NOT NULL,
    "group_chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "group_chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_chat_messages" (
    "id" TEXT NOT NULL,
    "group_chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "companion_id" TEXT,
    "content" TEXT NOT NULL,
    "status" "ConversationMessageStatus" NOT NULL DEFAULT 'completed',
    "turn_index" INTEGER NOT NULL,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "jti_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "replaced_by_token_id" TEXT,
    "parent_token_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "app" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "app" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'standard',
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "used_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "system_flags" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "target_id" TEXT,
    "result" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key_key" ON "settings"("user_id", "key");

-- CreateIndex
CREATE INDEX "companions_user_id_idx" ON "companions"("user_id");

-- CreateIndex
CREATE INDEX "companions_user_id_status_idx" ON "companions"("user_id", "status");

-- CreateIndex
CREATE INDEX "companion_conversations_user_id_updated_at_idx" ON "companion_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "companion_conversations_user_id_companion_id_key" ON "companion_conversations"("user_id", "companion_id");

-- CreateIndex
CREATE INDEX "companion_messages_conversation_id_created_at_idx" ON "companion_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "companion_messages_user_id_companion_id_created_at_idx" ON "companion_messages"("user_id", "companion_id", "created_at");

-- CreateIndex
CREATE INDEX "companion_memories_user_id_companion_id_status_importance_u_idx" ON "companion_memories"("user_id", "companion_id", "status", "importance", "updated_at");

-- CreateIndex
CREATE INDEX "companion_memories_source_message_id_idx" ON "companion_memories"("source_message_id");

-- CreateIndex
CREATE INDEX "companion_message_feedbacks_user_id_companion_id_updated_at_idx" ON "companion_message_feedbacks"("user_id", "companion_id", "updated_at");

-- CreateIndex
CREATE INDEX "companion_message_feedbacks_message_id_idx" ON "companion_message_feedbacks"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "companion_message_feedbacks_user_id_message_id_key" ON "companion_message_feedbacks"("user_id", "message_id");

-- CreateIndex
CREATE INDEX "companion_care_plans_enabled_next_run_at_ms_idx" ON "companion_care_plans"("enabled", "next_run_at_ms");

-- CreateIndex
CREATE UNIQUE INDEX "companion_care_plans_user_id_companion_id_key" ON "companion_care_plans"("user_id", "companion_id");

-- CreateIndex
CREATE INDEX "companion_care_events_user_id_companion_id_generated_at_ms_idx" ON "companion_care_events"("user_id", "companion_id", "generated_at_ms");

-- CreateIndex
CREATE INDEX "group_chats_user_id_updated_at_idx" ON "group_chats"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "group_chat_members_group_chat_id_status_display_order_idx" ON "group_chat_members"("group_chat_id", "status", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "group_chat_members_group_chat_id_companion_id_key" ON "group_chat_members"("group_chat_id", "companion_id");

-- CreateIndex
CREATE INDEX "group_chat_messages_group_chat_id_created_at_idx" ON "group_chat_messages"("group_chat_id", "created_at");

-- CreateIndex
CREATE INDEX "group_chat_messages_user_id_group_chat_id_created_at_idx" ON "group_chat_messages"("user_id", "group_chat_id", "created_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_app_idx" ON "auth_sessions"("app");

-- CreateIndex
CREATE INDEX "auth_sessions_revoked_at_idx" ON "auth_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_hash_key" ON "refresh_tokens"("jti_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_jti_hash_idx" ON "refresh_tokens"("jti_hash");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_user_id_app_idx" ON "user_roles"("user_id", "app");

-- CreateIndex
CREATE INDEX "user_roles_role_code_app_idx" ON "user_roles"("role_code", "app");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_app_role_code_key" ON "user_roles"("user_id", "app", "role_code");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_codes_code_key" ON "invitation_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_codes_used_by_key" ON "invitation_codes"("used_by");

-- CreateIndex
CREATE INDEX "invitation_codes_type_idx" ON "invitation_codes"("type");

-- CreateIndex
CREATE INDEX "invitation_codes_expires_at_idx" ON "invitation_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_code_key" ON "applications"("code");

-- CreateIndex
CREATE INDEX "application_auth_methods_provider_idx" ON "application_auth_methods"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "application_auth_methods_application_id_provider_key" ON "application_auth_methods"("application_id", "provider");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs"("actor");

-- CreateIndex
CREATE INDEX "admin_audit_logs_operation_idx" ON "admin_audit_logs"("operation");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_role_code_app_idx" ON "role_permissions"("role_code", "app");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_code_permission_id_app_key" ON "role_permissions"("role_code", "permission_id", "app");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invitation_code_id_fkey" FOREIGN KEY ("invitation_code_id") REFERENCES "invitation_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_auth_methods" ADD CONSTRAINT "application_auth_methods_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE CASCADE ON UPDATE CASCADE;
