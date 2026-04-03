-- Phase 4: Custom nudge frequency per trip
-- nudge_frequency_type: 'gentle' | 'normal' | 'aggressive' | 'custom'
-- nudge_frequency_value: interval in hours between nudge stages (used when type = 'custom')
ALTER TABLE trips ADD COLUMN IF NOT EXISTS nudge_frequency_type TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS nudge_frequency_value INTEGER;
