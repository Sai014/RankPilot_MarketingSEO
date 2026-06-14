-- RankPilot schema v9: technical audits (Phase 1)
-- Run in Supabase SQL Editor (safe to re-run)

CREATE TABLE IF NOT EXISTS domain_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('ssl', 'security_headers')),
  result JSONB,
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_audits_domain_id ON domain_audits(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_audits_type_created ON domain_audits(domain_id, audit_type, created_at DESC);

CREATE TABLE IF NOT EXISTS page_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('onpage')),
  result JSONB,
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_audits_domain_id ON page_audits(domain_id);
CREATE INDEX IF NOT EXISTS idx_page_audits_page_id ON page_audits(page_id);
CREATE INDEX IF NOT EXISTS idx_page_audits_page_created ON page_audits(page_id, audit_type, created_at DESC);

ALTER TABLE domain_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON domain_audits;
DROP POLICY IF EXISTS "Allow all" ON page_audits;
CREATE POLICY "Allow all" ON domain_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON page_audits FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
