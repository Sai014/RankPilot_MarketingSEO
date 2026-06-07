-- RankPilot schema v8: Google Search Console via Composio
-- Run in Supabase SQL Editor (safe to re-run)

ALTER TABLE domains ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE domains ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS gsc_last_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS google_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  composio_connected_account_id TEXT NOT NULL,
  connected_email TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON google_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_gsc_site_url ON domains(gsc_site_url) WHERE gsc_site_url IS NOT NULL;

ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON google_connections;
CREATE POLICY "Allow all" ON google_connections FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
