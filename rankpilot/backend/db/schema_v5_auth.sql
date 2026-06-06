-- RankPilot schema v5: auth user_id + RLS (safe to re-run on existing DB)
-- Run in Supabase SQL Editor if schema.sql failed partway through

ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagespeed_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_scrapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON projects;
DROP POLICY IF EXISTS "Allow all" ON sitemap_audits;
DROP POLICY IF EXISTS "Allow all" ON serp_tracks;
DROP POLICY IF EXISTS "Allow all" ON pagespeed_audits;
DROP POLICY IF EXISTS "Allow all" ON competitor_scrapes;

DROP POLICY IF EXISTS "Users manage own projects" ON projects;
CREATE POLICY "Users manage own projects" ON projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own sitemap_audits" ON sitemap_audits;
CREATE POLICY "Users manage own sitemap_audits" ON sitemap_audits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sitemap_audits.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sitemap_audits.project_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own serp_tracks" ON serp_tracks;
CREATE POLICY "Users manage own serp_tracks" ON serp_tracks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = serp_tracks.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = serp_tracks.project_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own pagespeed_audits" ON pagespeed_audits;
CREATE POLICY "Users manage own pagespeed_audits" ON pagespeed_audits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pagespeed_audits.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pagespeed_audits.project_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own competitor_scrapes" ON competitor_scrapes;
CREATE POLICY "Users manage own competitor_scrapes" ON competitor_scrapes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = competitor_scrapes.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = competitor_scrapes.project_id
        AND projects.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
