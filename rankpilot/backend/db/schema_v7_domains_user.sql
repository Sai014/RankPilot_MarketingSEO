-- RankPilot schema v7: scope domains to users (safe to re-run)
-- Run in Supabase SQL Editor

ALTER TABLE domains ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);

-- Allow same domain hostname for different accounts
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_domain_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_user_domain ON domains(user_id, domain);

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON domains;
DROP POLICY IF EXISTS "Users manage own domains" ON domains;
CREATE POLICY "Users manage own domains" ON domains
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all" ON pages;
DROP POLICY IF EXISTS "Users manage own pages" ON pages;
CREATE POLICY "Users manage own pages" ON pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = pages.domain_id
        AND domains.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = pages.domain_id
        AND domains.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow all" ON page_metrics;
DROP POLICY IF EXISTS "Users manage own page_metrics" ON page_metrics;
CREATE POLICY "Users manage own page_metrics" ON page_metrics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pages
      JOIN domains ON domains.id = pages.domain_id
      WHERE pages.id = page_metrics.page_id
        AND domains.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pages
      JOIN domains ON domains.id = pages.domain_id
      WHERE pages.id = page_metrics.page_id
        AND domains.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow all" ON pagespeed_audits;
DROP POLICY IF EXISTS "Users manage own pagespeed_audits" ON pagespeed_audits;
CREATE POLICY "Users manage own pagespeed_audits" ON pagespeed_audits
  FOR ALL
  USING (
    domain_id IS NULL
    OR EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = pagespeed_audits.domain_id
        AND domains.user_id = auth.uid()
    )
  )
  WITH CHECK (
    domain_id IS NULL
    OR EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = pagespeed_audits.domain_id
        AND domains.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow all" ON serp_tracks;
DROP POLICY IF EXISTS "Users manage own serp_tracks" ON serp_tracks;
CREATE POLICY "Users manage own serp_tracks" ON serp_tracks
  FOR ALL
  USING (
    domain_id IS NULL
    OR EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = serp_tracks.domain_id
        AND domains.user_id = auth.uid()
    )
  )
  WITH CHECK (
    domain_id IS NULL
    OR EXISTS (
      SELECT 1 FROM domains
      WHERE domains.id = serp_tracks.domain_id
        AND domains.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
