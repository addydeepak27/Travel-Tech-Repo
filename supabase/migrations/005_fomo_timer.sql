-- Phase 4: Timer + FOMO Email System

-- Per-member: which FOMO stage (0 = none sent, 1/2/3 = escalating emails)
-- and when the last one fired
ALTER TABLE members ADD COLUMN IF NOT EXISTS fomo_stage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_fomo_sent_at TIMESTAMPTZ;

-- Per-trip: when questionnaire collection opened and the hard deadline
ALTER TABLE trips ADD COLUMN IF NOT EXISTS questionnaire_started_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS questionnaire_deadline_at TIMESTAMPTZ;
