-- Phase 7: Store 3 AI-generated itinerary plans before members vote on one
ALTER TABLE trips ADD COLUMN IF NOT EXISTS itinerary_options JSONB;
