ALTER TABLE domains ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS target_countries JSONB DEFAULT '[]'::jsonb;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS sitemap_count INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
