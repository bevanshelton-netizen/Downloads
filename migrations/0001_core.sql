PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'beta' CHECK (status IN ('draft','beta','live','paused')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('creator','advertiser','partner','viewer','support')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  offer_code TEXT,
  consent INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0,1)),
  privacy_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','closed')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_platform_created ON leads(platform_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(platform_id, status, kind);

CREATE TABLE IF NOT EXISTS creator_invites (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  terms_version TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform_id, email),
  UNIQUE(platform_id, handle)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_creator ON sessions(creator_id);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_key TEXT,
  mime_type TEXT,
  bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','uploading','published','blocked','deleted')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted','private')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_feed ON videos(platform_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS viewer_sessions (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_sessions (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewer_session_id TEXT NOT NULL REFERENCES viewer_sessions(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0 CHECK (qualified IN (0,1)),
  last_heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, viewer_session_id)
);
CREATE INDEX IF NOT EXISTS idx_watch_video ON watch_sessions(video_id, qualified);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  currency TEXT NOT NULL CHECK (length(currency)=3),
  gross_minor INTEGER NOT NULL,
  external_cost_minor INTEGER NOT NULL DEFAULT 0,
  creator_minor INTEGER NOT NULL,
  platform_minor INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ads','subscription_pool','tip','membership','event','brand','course','merch','licensing','adjustment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid','reversed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ledger_creator ON ledger_entries(creator_id, currency, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key, window_date)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  platform_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

INSERT OR IGNORE INTO platforms (id, slug, name, status)
VALUES ('plt_videonomy', 'videonomy', 'VIDEONOMY', 'beta');
