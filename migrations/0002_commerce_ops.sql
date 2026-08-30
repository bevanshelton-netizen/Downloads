CREATE TABLE IF NOT EXISTS commerce_packages (
  code TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sponsorship','advertising','membership','event','course','other')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 500),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency='ZAR'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  package_code TEXT REFERENCES commerce_packages(code) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency='ZAR'),
  provider TEXT NOT NULL DEFAULT 'payfast' CHECK (provider IN ('payfast','manual')),
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled','refunded')),
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(platform_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_provider_ref ON payment_intents(provider,provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','correction','deletion','objection')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','verified','processing','completed','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  reporter_email TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','actioned','dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(platform_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS email_jobs (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platforms(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','cancelled')),
  provider_ref TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status,created_at);

INSERT OR IGNORE INTO commerce_packages(code,platform_id,name,kind,amount_minor,currency) VALUES
('VZ-LAUNCH-1500','plt_videonomy','Launch Supporter','sponsorship',150000,'ZAR'),
('VZ-GROW-5000','plt_videonomy','Growth Partner','advertising',500000,'ZAR'),
('VZ-FOUNDING-12500','plt_videonomy','Founding Brand Partner','advertising',1250000,'ZAR');
