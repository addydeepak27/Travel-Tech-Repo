-- ── 003_organizer_abandonment.sql ─────────────────────────────────────────
-- Tracks organizer activity for abandonment escalation.
-- Run this in the Supabase SQL editor before deploying.

-- Tracks last explicit organizer action (nudge, status change, etc.)
-- Falls back to trips.created_at when null (for existing trips)
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Fixes missing updated_at column that cron/nudge/route.ts already references
ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
