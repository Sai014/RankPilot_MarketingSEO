-- Page-level target country overrides (optional; inherits from domain when null)
ALTER TABLE pages ADD COLUMN IF NOT EXISTS target_countries JSONB DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
