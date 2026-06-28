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
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "user_roles_user_id_app_idx" ON "user_roles"("user_id", "app");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_app_role_key" ON "user_roles"("user_id", "app", "role");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
