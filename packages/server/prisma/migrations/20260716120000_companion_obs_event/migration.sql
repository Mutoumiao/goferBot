-- Companion observability side-channel (safety hard-stop etc.)
CREATE TABLE "companion_obs_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "companion_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "user_id" TEXT,
    "boundary_action" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_obs_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "companion_obs_events_type_created_at_idx" ON "companion_obs_events"("type", "created_at");
CREATE INDEX "companion_obs_events_companion_id_created_at_idx" ON "companion_obs_events"("companion_id", "created_at");

ALTER TABLE "companion_obs_events" ADD CONSTRAINT "companion_obs_events_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companion_obs_events" ADD CONSTRAINT "companion_obs_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
