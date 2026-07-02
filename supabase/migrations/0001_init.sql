-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table
CREATE TABLE leads (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('real_estate_buyer', 'real_estate_seller', 'mortgage', 'insurance', 'b2b')),
  name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  company TEXT,
  location TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'sold', 'invalid')),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  sold_to_request_id BIGINT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Buyer requests (from Google Form)
CREATE TABLE buyer_requests (
  id BIGSERIAL PRIMARY KEY,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  category_wanted TEXT NOT NULL,
  quantity_wanted INTEGER,
  price_offered DECIMAL(10, 2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'fulfilled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (manual log)
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT NOW(),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT,
  quantity INTEGER,
  linked_buyer_request_id BIGINT REFERENCES buyer_requests(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach contacts (agents/brokers we sell to)
CREATE TABLE outreach_contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('email', 'linkedin', 'facebook')),
  contact_value TEXT NOT NULL,
  category_interest TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'bounced')),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach drafts (LinkedIn/Facebook)
CREATE TABLE outreach_drafts (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT CHECK (channel IN ('linkedin', 'facebook')),
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'sent', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for service role, deny for anon)
CREATE POLICY "service_role_all" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON buyer_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON outreach_contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON outreach_drafts FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_leads_category ON leads(category);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_buyer_requests_status ON buyer_requests(status);
CREATE INDEX idx_buyer_requests_email ON buyer_requests(buyer_email);
CREATE INDEX idx_payments_date ON payments(date DESC);
CREATE INDEX idx_outreach_contacts_channel ON outreach_contacts(channel);
CREATE INDEX idx_outreach_drafts_status ON outreach_drafts(status);
