-- ═══════════════════════════════════════════════════════════════════════
-- Appply — Startup Funding & Company Intelligence Schema
-- ═══════════════════════════════════════════════════════════════════════
-- These tables store SHARED intelligence data (not user-scoped).
-- All authenticated users can READ; only service_role can WRITE.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Companies (canonical, deduplicated) ───────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  slug TEXT UNIQUE,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  industry TEXT,
  sub_industry TEXT,
  location TEXT,
  country TEXT,
  founded_year INTEGER,
  stage TEXT CHECK (stage IN (
    'pre-seed', 'seed', 'early', 'growth', 'late', 'public', 'acquired', 'closed'
  )),
  employee_count INTEGER,
  employee_range TEXT,
  products TEXT,
  markets TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  twitter_url TEXT,
  crunchbase_url TEXT,
  angellist_url TEXT,
  github_url TEXT,
  is_indian BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_canonical_name ON companies(canonical_name);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(stage);
CREATE INDEX IF NOT EXISTS idx_companies_is_indian ON companies(is_indian);

-- GIN index for alias matching
CREATE INDEX IF NOT EXISTS idx_companies_aliases ON companies USING GIN(aliases);

-- ─── 2. Funding Rounds ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL CHECK (round_type IN (
    'pre-seed', 'seed', 'angel', 'series-a', 'series-b', 'series-c',
    'series-d', 'series-e', 'series-f', 'series-g', 'series-h',
    'bridge', 'debt', 'grant', 'convertible-note', 'equity-crowdfunding',
    'secondary', 'ipo', 'post-ipo', 'undisclosed', 'strategic', 'other'
  )),
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  amount_usd NUMERIC,
  funding_date DATE,
  lead_investor TEXT,
  other_investors TEXT[] DEFAULT '{}',
  valuation NUMERIC,
  valuation_currency TEXT DEFAULT 'USD',
  total_raised NUMERIC,
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
    'confirmed', 'high_confidence', 'estimated', 'inferred', 'unverified'
  )),
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  source_count INTEGER DEFAULT 1,
  dedupe_hash TEXT UNIQUE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_rounds_company ON funding_rounds(company_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_date ON funding_rounds(funding_date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_type ON funding_rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_amount ON funding_rounds(amount_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_verification ON funding_rounds(verification_status);

-- ─── 3. Company People (founders, executives, board) ─────────────────
CREATE TABLE IF NOT EXISTS company_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  title TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  background TEXT,
  is_founder BOOLEAN DEFAULT false,
  is_current BOOLEAN DEFAULT true,
  joined_date DATE,
  left_date DATE,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_people_company ON company_people(company_id);
CREATE INDEX IF NOT EXISTS idx_company_people_name ON company_people(name);
CREATE INDEX IF NOT EXISTS idx_company_people_founder ON company_people(is_founder) WHERE is_founder = true;

-- ─── 4. Investors ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  type TEXT CHECK (type IN (
    'vc', 'angel', 'pe', 'cvc', 'accelerator', 'incubator',
    'government', 'family-office', 'hedge-fund', 'crowdfunding', 'other'
  )),
  website TEXT,
  logo_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  description TEXT,
  portfolio_count INTEGER DEFAULT 0,
  focus_industries TEXT[] DEFAULT '{}',
  focus_stages TEXT[] DEFAULT '{}',
  focus_geographies TEXT[] DEFAULT '{}',
  location TEXT,
  founded_year INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investors_name ON investors(name);
CREATE INDEX IF NOT EXISTS idx_investors_slug ON investors(slug);
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(type);

-- ─── 5. Investor-Funding Participation (many-to-many) ────────────────
CREATE TABLE IF NOT EXISTS funding_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_round_id UUID NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  is_lead BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funding_round_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_funding_investors_round ON funding_investors(funding_round_id);
CREATE INDEX IF NOT EXISTS idx_funding_investors_investor ON funding_investors(investor_id);

-- ─── 6. News Events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  headline TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'funding', 'hiring', 'growth', 'product', 'partnership',
    'ma', 'workforce', 'leadership', 'ipo', 'other'
  )),
  event_type TEXT NOT NULL,
  event_date DATE,
  publication_date DATE,
  summary TEXT,
  key_facts JSONB DEFAULT '[]'::jsonb,
  people_involved TEXT[] DEFAULT '{}',
  funding_amount NUMERIC,
  funding_currency TEXT,
  investors TEXT[] DEFAULT '{}',
  hiring_info JSONB DEFAULT '{}'::jsonb,
  location TEXT,
  source_name TEXT,
  source_url TEXT,
  additional_sources TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
    'confirmed', 'high_confidence', 'estimated', 'inferred', 'unverified'
  )),
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  dedupe_hash TEXT UNIQUE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_events_company ON news_events(company_id);
CREATE INDEX IF NOT EXISTS idx_news_events_category ON news_events(category);
CREATE INDEX IF NOT EXISTS idx_news_events_event_date ON news_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_publication_date ON news_events(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_event_type ON news_events(event_type);

-- ─── 7. Company Historical Snapshots ─────────────────────────────────
CREATE TABLE IF NOT EXISTS company_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  employee_count INTEGER,
  open_jobs_count INTEGER,
  valuation NUMERIC,
  total_funding NUMERIC,
  stage TEXT,
  locations TEXT[] DEFAULT '{}',
  leadership JSONB DEFAULT '{}'::jsonb,
  hiring_metrics JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_company_snapshots_company ON company_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_company_snapshots_date ON company_snapshots(snapshot_date DESC);

-- ─── 8. Company-Job Linkage ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_job_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  match_confidence NUMERIC DEFAULT 0 CHECK (match_confidence BETWEEN 0 AND 1),
  matched_by TEXT DEFAULT 'name',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_company_job_links_company ON company_job_links(company_id);
CREATE INDEX IF NOT EXISTS idx_company_job_links_job ON company_job_links(job_id);

-- ─── 9. Scrape Sources Registry ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'rss', 'api', 'web', 'ai', 'manual'
  )),
  url TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  last_scraped_at TIMESTAMPTZ,
  scrape_interval_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'disabled')),
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  items_found INTEGER DEFAULT 0,
  region TEXT DEFAULT 'global' CHECK (region IN ('india', 'global', 'both')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_sources_status ON scrape_sources(status);
CREATE INDEX IF NOT EXISTS idx_scrape_sources_type ON scrape_sources(type);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS Policies — READ for all authenticated, WRITE for service_role only
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_job_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_sources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read funding_rounds" ON funding_rounds FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read company_people" ON company_people FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read investors" ON investors FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read funding_investors" ON funding_investors FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read news_events" ON news_events FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read company_snapshots" ON company_snapshots FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read company_job_links" ON company_job_links FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read scrape_sources" ON scrape_sources FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Only service_role can write (used by backend pipeline)
CREATE POLICY "Service role can write companies" ON companies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write funding_rounds" ON funding_rounds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write company_people" ON company_people FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write investors" ON investors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write funding_investors" ON funding_investors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write news_events" ON news_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write company_snapshots" ON company_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write company_job_links" ON company_job_links FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can write scrape_sources" ON scrape_sources FOR ALL USING (auth.role() = 'service_role');

-- Grant full access to service_role
GRANT ALL PRIVILEGES ON companies TO service_role;
GRANT ALL PRIVILEGES ON funding_rounds TO service_role;
GRANT ALL PRIVILEGES ON company_people TO service_role;
GRANT ALL PRIVILEGES ON investors TO service_role;
GRANT ALL PRIVILEGES ON funding_investors TO service_role;
GRANT ALL PRIVILEGES ON news_events TO service_role;
GRANT ALL PRIVILEGES ON company_snapshots TO service_role;
GRANT ALL PRIVILEGES ON company_job_links TO service_role;
GRANT ALL PRIVILEGES ON scrape_sources TO service_role;

-- Grant SELECT to authenticated role
GRANT SELECT ON companies TO authenticated;
GRANT SELECT ON funding_rounds TO authenticated;
GRANT SELECT ON company_people TO authenticated;
GRANT SELECT ON investors TO authenticated;
GRANT SELECT ON funding_investors TO authenticated;
GRANT SELECT ON news_events TO authenticated;
GRANT SELECT ON company_snapshots TO authenticated;
GRANT SELECT ON company_job_links TO authenticated;
GRANT SELECT ON scrape_sources TO authenticated;
