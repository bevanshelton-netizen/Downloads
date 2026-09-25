PRAGMA foreign_keys = ON;

ALTER TABLE videos ADD COLUMN format TEXT NOT NULL DEFAULT 'video'
  CHECK (format IN ('short','video'));
ALTER TABLE videos ADD COLUMN allow_comments INTEGER NOT NULL DEFAULT 1
  CHECK (allow_comments IN (0,1));

ALTER TABLE ledger_entries ADD COLUMN creator_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_creator_payment
  ON ledger_entries(creator_payment_id)
  WHERE creator_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS creator_profiles (
  creator_id TEXT PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  bio TEXT,
  website_url TEXT,
  country_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  viewer_session_id TEXT NOT NULL REFERENCES viewer_sessions(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(viewer_session_id, creator_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_creator ON follows(creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS video_reactions (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewer_session_id TEXT NOT NULL REFERENCES viewer_sessions(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like' CHECK (reaction IN ('like')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, viewer_session_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_reactions_video ON video_reactions(video_id, reaction);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewer_session_id TEXT NOT NULL REFERENCES viewer_sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Viewer',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','held','blocked','deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS creator_payments (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tip','membership','event')),
  payer_name TEXT,
  payer_email TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 1000),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency='ZAR'),
  provider TEXT NOT NULL DEFAULT 'ikhokha' CHECK (provider IN ('ikhokha','payfast','manual')),
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','refunded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_payment_provider_ref
  ON creator_payments(provider, provider_ref)
  WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_payment_creator
  ON creator_payments(creator_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS payout_profiles (
  creator_id TEXT PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_ref TEXT NOT NULL,
  display_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (length(currency)=3),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 10000),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','processing','paid','rejected','cancelled')),
  admin_notes TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status
  ON payout_requests(platform_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS payout_request_entries (
  payout_request_id TEXT NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
  ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  PRIMARY KEY(payout_request_id, ledger_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_payout_entry_ledger
  ON payout_request_entries(ledger_entry_id);
