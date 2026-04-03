-- Phase 3: Budget Alignment System
-- budget_range: human-readable total trip budget label (e.g. '₹50k–1L')
-- budget_value_per_day: numeric daily spend per person in INR (derived from tier)
ALTER TABLE members ADD COLUMN IF NOT EXISTS budget_range TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS budget_value_per_day INTEGER;
