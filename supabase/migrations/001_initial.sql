-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Trips ──────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'draft',
  organizer_id         UUID,
  destination_options  TEXT[]      NOT NULL DEFAULT '{}',
  confirmed_destination TEXT,
  confirmed_hotel      JSONB,
  hotel_options        JSONB,
  itinerary            JSONB,
  departure_date       DATE,
  return_date          DATE,
  group_budget_zone    JSONB,
  weighted_median_tier TEXT,
  gamification_enabled BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Members ────────────────────────────────────────────────────────────────
CREATE TABLE members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  phone         TEXT        NOT NULL,
  name          TEXT,
  avatar        TEXT,
  avatar_suffix TEXT,
  budget_tier   TEXT,
  status        TEXT        NOT NULL DEFAULT 'invited',
  pace_vote     TEXT,
  spend_vote    TEXT,
  points        INTEGER     NOT NULL DEFAULT 0,
  opt_out       BOOLEAN     NOT NULL DEFAULT false,
  joined_at     TIMESTAMPTZ
);

-- Add FK from trips.organizer_id → members.id (deferred to avoid circular dep)
ALTER TABLE trips
  ADD CONSTRAINT trips_organizer_id_fkey
  FOREIGN KEY (organizer_id) REFERENCES members(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ── Votes ──────────────────────────────────────────────────────────────────
-- Primary key enforces one vote per member per vote_type — safe upsert target
CREATE TABLE votes (
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id  UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  vote_type  TEXT        NOT NULL,  -- 'destination' | 'hotel' | 'itinerary'
  value      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, member_id, vote_type)
);

-- ── Mission tasks ──────────────────────────────────────────────────────────
CREATE TABLE mission_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id    UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  avatar       TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  deadline     DATE        NOT NULL,
  points       INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending',
  note         TEXT,
  completed_at TIMESTAMPTZ
);

-- ── For You callouts ───────────────────────────────────────────────────────
-- Generated once at itinerary lock, cached here
CREATE TABLE for_you_callouts (
  member_id UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  trip_id   UUID    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day       INTEGER NOT NULL,
  callout   TEXT    NOT NULL,
  PRIMARY KEY (member_id, trip_id, day)
);

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Partial unique index: one member per avatar per trip, only when avatar_suffix is NULL
-- (overflow groups have avatar_suffix like 'A'/'B', so they bypass this constraint)
CREATE UNIQUE INDEX members_avatar_unique_idx
  ON members(trip_id, avatar)
  WHERE avatar IS NOT NULL AND avatar_suffix IS NULL;

CREATE INDEX members_trip_id_idx          ON members(trip_id);
CREATE INDEX members_phone_idx            ON members(phone);
CREATE INDEX members_opt_out_idx          ON members(opt_out) WHERE opt_out = false;
CREATE INDEX votes_trip_id_type_idx       ON votes(trip_id, vote_type);
CREATE INDEX mission_tasks_member_id_idx  ON mission_tasks(member_id);
CREATE INDEX mission_tasks_trip_id_idx    ON mission_tasks(trip_id);
CREATE INDEX mission_tasks_status_idx     ON mission_tasks(status);
CREATE INDEX for_you_trip_member_idx      ON for_you_callouts(trip_id, member_id);

-- ── Helper: increment member points atomically ─────────────────────────────
CREATE OR REPLACE FUNCTION increment_member_points(mid UUID, pts INTEGER)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE members SET points = points + pts WHERE id = mid;
$$;
