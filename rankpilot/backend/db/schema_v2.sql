-- RankPilot schema v2: domains + pages
-- Run in Supabase SQL Editor (safe to re-run)

-- Domains (one-time onboarding)
CREATE TABLE IF NOT EXISTS domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'active', 'error')),
  sitemap_source TEXT,
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  display_name TEXT,
  target_countries JSONB DEFAULT '[]'::jsonb,
  sitemap_count INTEGER DEFAULT 0
);

-- Pages discovered from sitemap per domain
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  path TEXT,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain_id, url)
);

CREATE INDEX IF NOT EXISTS idx_pages_domain_id ON pages(domain_id);

-- Link audit tables to domains (only if tables exist)
DO $$ BEGIN
  ALTER TABLE pagespeed_audits ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;
  ALTER TABLE serp_tracks ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;
  ALTER TABLE pagespeed_audits ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id) ON DELETE SET NULL;
  ALTER TABLE serp_tracks ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Audit tables not found — run schema.sql first or skip audit linking';
END $$;

-- Standalone audit tables (if schema.sql was never run)
CREATE TABLE IF NOT EXISTS pagespeed_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  strategy TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS serp_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  location TEXT,
  target_domain TEXT,
  target_rank INTEGER,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pagespeed_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON pagespeed_audits;
DROP POLICY IF EXISTS "Allow all" ON serp_tracks;
CREATE POLICY "Allow all" ON pagespeed_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON serp_tracks FOR ALL USING (true) WITH CHECK (true);

-- Page-level metrics placeholders (GSC, scraper — populate later)
CREATE TABLE IF NOT EXISTS page_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  clicks INTEGER,
  impressions INTEGER,
  ctr NUMERIC,
  avg_position NUMERIC,
  leads INTEGER,
  scrape_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_id)
);

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON domains;
DROP POLICY IF EXISTS "Allow all" ON pages;
DROP POLICY IF EXISTS "Allow all" ON page_metrics;

CREATE POLICY "Allow all" ON domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON page_metrics FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
