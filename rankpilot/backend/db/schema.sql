-- RankPilot Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sitemap audits
CREATE TABLE IF NOT EXISTS sitemap_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  total_urls INTEGER,
  source TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERP tracks
CREATE TABLE IF NOT EXISTS serp_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location TEXT,
  target_domain TEXT,
  target_rank INTEGER,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PageSpeed audits
CREATE TABLE IF NOT EXISTS pagespeed_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  strategy TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Competitor scrapes
CREATE TABLE IF NOT EXISTS competitor_scrapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagespeed_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_scrapes ENABLE ROW LEVEL SECURITY;

-- MVP policies (open access — tighten before production)
DROP POLICY IF EXISTS "Allow all" ON projects;
DROP POLICY IF EXISTS "Allow all" ON sitemap_audits;
DROP POLICY IF EXISTS "Allow all" ON serp_tracks;
DROP POLICY IF EXISTS "Allow all" ON pagespeed_audits;
DROP POLICY IF EXISTS "Allow all" ON competitor_scrapes;

CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sitemap_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON serp_tracks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pagespeed_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON competitor_scrapes FOR ALL USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache (fixes PGRST205 after creating tables)
NOTIFY pgrst, 'reload schema';
