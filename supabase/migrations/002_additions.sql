-- ── 002_additions.sql ──────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor before deploying the app.

-- ── Trips additions ────────────────────────────────────────────────────────
ALTER TABLE trips ADD COLUMN IF NOT EXISTS travel_code TEXT UNIQUE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS departure_date_text TEXT; -- backup if date column exists
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination_vote_scheduled_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS itinerary_cost_alert BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS trips_travel_code_idx ON trips(travel_code) WHERE travel_code IS NOT NULL;

-- Convert destination_options to JSONB to store full objects (name, emoji, estimated_cost, hotel_range)
-- Note: if existing rows have TEXT[] data, this migration preserves them as JSON strings
ALTER TABLE trips ALTER COLUMN destination_options DROP DEFAULT;
ALTER TABLE trips ALTER COLUMN destination_options TYPE JSONB USING to_jsonb(destination_options);
ALTER TABLE trips ALTER COLUMN destination_options SET DEFAULT '[]'::jsonb;

-- ── Members additions ──────────────────────────────────────────────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS activity_pref TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS trip_priority TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS special_requests TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS brownie_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS budget_assumed BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_auto_assigned BOOLEAN DEFAULT FALSE;

-- New member statuses used in WhatsApp questionnaire flow
-- (status column is TEXT so no enum changes needed)

-- Avatar uniqueness per trip (partial index — allows suffix-based duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS members_trip_avatar_unique
  ON members(trip_id, avatar)
  WHERE avatar IS NOT NULL AND avatar_suffix IS NULL;

-- ── Votes additions ────────────────────────────────────────────────────────
ALTER TABLE votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ── Brownie events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brownie_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points_earned INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, member_id, event_type)
);

-- ── Nudges ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  stage INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, member_id, vote_type, stage)
);

-- ── Duplicate webhook prevention ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_messages (
  message_sid TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Message log (rate limiting: max 2/user/day) ────────────────────────────
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  message_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS message_log_member_day ON message_log(member_id, sent_at);

-- ── DB functions ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_member_brownie_points(p_member_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
  UPDATE members SET brownie_points = brownie_points + p_amount WHERE id = p_member_id;
$$ LANGUAGE SQL;
