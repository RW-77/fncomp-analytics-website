-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "damage_dealt_events" (
    "id" SERIAL NOT NULL,
    "match_id" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "game_time_seconds" INTEGER,
    "actor_id" INTEGER,
    "recipient_id" INTEGER,
    "weapon_id" VARCHAR(100) NOT NULL,
    "weapon_type" VARCHAR(50),
    "damage_amount" DOUBLE PRECISION NOT NULL,
    "actor_x" DOUBLE PRECISION NOT NULL,
    "actor_y" DOUBLE PRECISION NOT NULL,
    "actor_z" DOUBLE PRECISION NOT NULL,
    "recipient_x" DOUBLE PRECISION NOT NULL,
    "recipient_y" DOUBLE PRECISION NOT NULL,
    "recipient_z" DOUBLE PRECISION NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "zone" INTEGER NOT NULL,

    CONSTRAINT "damage_dealt_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elimination_events" (
    "id" SERIAL NOT NULL,
    "match_id" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "game_time_seconds" INTEGER,
    "actor_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "weapon_id" VARCHAR(100) NOT NULL,
    "weapon_type" VARCHAR(50),
    "actor_x" DOUBLE PRECISION NOT NULL,
    "actor_y" DOUBLE PRECISION NOT NULL,
    "actor_z" DOUBLE PRECISION NOT NULL,
    "recipient_x" DOUBLE PRECISION NOT NULL,
    "recipient_y" DOUBLE PRECISION NOT NULL,
    "recipient_z" DOUBLE PRECISION NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "zone" INTEGER NOT NULL,

    CONSTRAINT "elimination_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_windows" (
    "event_window_id" VARCHAR(100) NOT NULL,
    "processing" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL,
    "failed" BOOLEAN NOT NULL,
    "discovered_at" TIMESTAMP(6) NOT NULL,
    "last_processing_start" TIMESTAMP(6),
    "last_processed" TIMESTAMP(6),
    "last_failed" TIMESTAMP(6),
    "start_time" TIMESTAMP(6),
    "end_time" TIMESTAMP(6),
    "total_matches" INTEGER NOT NULL,
    "processed_matches" INTEGER NOT NULL,

    CONSTRAINT "event_windows_pkey" PRIMARY KEY ("event_window_id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" SERIAL NOT NULL,
    "epic_id" VARCHAR(100) NOT NULL,
    "epic_username" VARCHAR(100) NOT NULL,
    "match_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "match_id" VARCHAR(50) NOT NULL,
    "event_window_id" VARCHAR(50) NOT NULL,
    "processing" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL,
    "failed" BOOLEAN NOT NULL,
    "event_id" VARCHAR(100),
    "start_time" TIMESTAMP(6) NOT NULL,
    "end_time" TIMESTAMP(6),
    "gamemode" VARCHAR(100),
    "duration" TIMESTAMP(6),
    "player_count" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE INDEX "idx_damage_actor" ON "damage_dealt_events"("actor_id");

-- CreateIndex
CREATE INDEX "idx_damage_distance" ON "damage_dealt_events"("distance");

-- CreateIndex
CREATE INDEX "idx_damage_match" ON "damage_dealt_events"("match_id");

-- CreateIndex
CREATE INDEX "idx_damage_recipient" ON "damage_dealt_events"("recipient_id");

-- CreateIndex
CREATE INDEX "idx_damage_time" ON "damage_dealt_events"("game_time_seconds");

-- CreateIndex
CREATE INDEX "idx_damage_weapon" ON "damage_dealt_events"("weapon_type");

-- CreateIndex
CREATE INDEX "idx_damage_zone" ON "damage_dealt_events"("zone");

-- CreateIndex
CREATE INDEX "idx_elim_actor" ON "elimination_events"("actor_id");

-- CreateIndex
CREATE INDEX "idx_elim_match" ON "elimination_events"("match_id");

-- CreateIndex
CREATE INDEX "idx_elim_recipient" ON "elimination_events"("recipient_id");

-- CreateIndex
CREATE INDEX "idx_elim_zone" ON "elimination_events"("zone");

-- CreateIndex
CREATE INDEX "idx_player_match" ON "match_players"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_player_epic_match" ON "match_players"("epic_id", "match_id");

-- AddForeignKey
ALTER TABLE "damage_dealt_events" ADD CONSTRAINT "damage_dealt_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "match_players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "damage_dealt_events" ADD CONSTRAINT "damage_dealt_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "damage_dealt_events" ADD CONSTRAINT "damage_dealt_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "match_players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elimination_events" ADD CONSTRAINT "elimination_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "match_players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elimination_events" ADD CONSTRAINT "elimination_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "elimination_events" ADD CONSTRAINT "elimination_events_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "match_players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_window_id_fkey" FOREIGN KEY ("event_window_id") REFERENCES "event_windows"("event_window_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

