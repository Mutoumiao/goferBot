-- CreateEnums
CREATE TYPE "CompanionStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "ConversationMessageStatus" AS ENUM ('completed', 'failed');
CREATE TYPE "MemoryType" AS ENUM ('preference', 'boundary', 'relationship_goal', 'conversation_style', 'important_fact');
CREATE TYPE "MemoryStatus" AS ENUM ('active', 'disabled', 'deleted');
CREATE TYPE "FeedbackRating" AS ENUM ('positive', 'negative');
CREATE TYPE "CareFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'custom');
CREATE TYPE "CareStatus" AS ENUM ('pending', 'sent', 'read', 'failed');
CREATE TYPE "GroupMemberStatus" AS ENUM ('active', 'removed');
CREATE TYPE "SenderType" AS ENUM ('user', 'agent');

-- CreateTable: companions
CREATE TABLE "companions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
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

-- CreateTable: companion_conversations
CREATE TABLE "companion_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "title" TEXT,
    "summary" VARCHAR(1600),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: companion_messages
CREATE TABLE "companion_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ConversationMessageStatus" NOT NULL DEFAULT 'completed',
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: companion_memories
CREATE TABLE "companion_memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "status" "MemoryStatus" NOT NULL DEFAULT 'active',
    "source_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: companion_message_feedbacks
CREATE TABLE "companion_message_feedbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_message_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: companion_care_plans
CREATE TABLE "companion_care_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
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

-- CreateTable: companion_care_events
CREATE TABLE "companion_care_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "care_plan_id" UUID,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "scene" TEXT NOT NULL,
    "status" "CareStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "metadata_json" TEXT,
    "generated_at_ms" BIGINT NOT NULL,
    "read_at_ms" BIGINT,

    CONSTRAINT "companion_care_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: group_chats
CREATE TABLE "group_chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at_ms" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable: group_chat_members
CREATE TABLE "group_chat_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "group_chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: group_chat_messages
CREATE TABLE "group_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "companion_id" UUID,
    "content" TEXT NOT NULL,
    "status" "ConversationMessageStatus" NOT NULL DEFAULT 'completed',
    "turn_index" INTEGER NOT NULL,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "companions_user_id_idx" ON "companions"("user_id");
CREATE INDEX "companions_user_id_status_idx" ON "companions"("user_id", "status");

CREATE INDEX "companion_conversations_user_id_updated_at_idx" ON "companion_conversations"("user_id", "updated_at");
CREATE UNIQUE INDEX "companion_conversations_user_id_companion_id_key" ON "companion_conversations"("user_id", "companion_id");

CREATE INDEX "companion_messages_conversation_id_created_at_idx" ON "companion_messages"("conversation_id", "created_at");
CREATE INDEX "companion_messages_user_id_companion_id_created_at_idx" ON "companion_messages"("user_id", "companion_id", "created_at");

CREATE INDEX "companion_memories_user_id_companion_id_status_importance_u_idx" ON "companion_memories"("user_id", "companion_id", "status", "importance", "updated_at");
CREATE INDEX "companion_memories_source_message_id_idx" ON "companion_memories"("source_message_id");

CREATE INDEX "companion_message_feedbacks_user_id_companion_id_updated_at_idx" ON "companion_message_feedbacks"("user_id", "companion_id", "updated_at");
CREATE INDEX "companion_message_feedbacks_message_id_idx" ON "companion_message_feedbacks"("message_id");
CREATE UNIQUE INDEX "companion_message_feedbacks_user_id_message_id_key" ON "companion_message_feedbacks"("user_id", "message_id");

CREATE INDEX "companion_care_plans_enabled_next_run_at_ms_idx" ON "companion_care_plans"("enabled", "next_run_at_ms");
CREATE UNIQUE INDEX "companion_care_plans_user_id_companion_id_key" ON "companion_care_plans"("user_id", "companion_id");

CREATE INDEX "companion_care_events_user_id_companion_id_generated_at_ms_idx" ON "companion_care_events"("user_id", "companion_id", "generated_at_ms");

CREATE INDEX "group_chats_user_id_updated_at_idx" ON "group_chats"("user_id", "updated_at");

CREATE INDEX "group_chat_members_group_chat_id_status_display_order_idx" ON "group_chat_members"("group_chat_id", "status", "display_order");
CREATE UNIQUE INDEX "group_chat_members_group_chat_id_companion_id_key" ON "group_chat_members"("group_chat_id", "companion_id");

CREATE INDEX "group_chat_messages_group_chat_id_created_at_idx" ON "group_chat_messages"("group_chat_id", "created_at");
CREATE INDEX "group_chat_messages_user_id_group_chat_id_created_at_idx" ON "group_chat_messages"("user_id", "group_chat_id", "created_at");

-- AddForeignKeys
ALTER TABLE "companions" ADD CONSTRAINT "companions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_conversations" ADD CONSTRAINT "companion_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_conversations" ADD CONSTRAINT "companion_conversations_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_memories" ADD CONSTRAINT "companion_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_memories" ADD CONSTRAINT "companion_memories_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_message_feedbacks" ADD CONSTRAINT "companion_message_feedbacks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_care_plans" ADD CONSTRAINT "companion_care_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_care_plans" ADD CONSTRAINT "companion_care_plans_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_care_events" ADD CONSTRAINT "companion_care_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "companion_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chats" ADD CONSTRAINT "group_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chat_members" ADD CONSTRAINT "group_chat_members_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chat_messages" ADD CONSTRAINT "group_chat_messages_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_chat_messages" ADD CONSTRAINT "group_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
