-- Add vote_deadline to trips (organizer-set deadline for destination/hotel voting polls)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vote_deadline TIMESTAMPTZ;
