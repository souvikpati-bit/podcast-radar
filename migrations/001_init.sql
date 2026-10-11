-- Idempotent schema. Statements are separated by a semicolon at the end of a line.

CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  youtube_channel_id TEXT,
  uploads_playlist_id TEXT,
  title TEXT,
  thumbnail TEXT,
  host_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_clean TEXT,
  description_raw TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  published_at TIMESTAMPTZ NOT NULL,
  duration_s INTEGER,
  is_short BOOLEAN NOT NULL DEFAULT FALSE,
  url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS videos_published_idx ON videos (published_at DESC);

-- Shows read from a podcast RSS feed (no YouTube quota) have a feed_url and no YouTube channel id.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS feed_url TEXT;

-- Shows added automatically when data was thin. Auto-added shows that fail the guest-episode rule are removed again.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS auto_added BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS feed_checked_at TIMESTAMPTZ;

-- Shows the system tried and rejected, so it never tries them again.
CREATE TABLE IF NOT EXISTS discovery_rejects (
  key TEXT PRIMARY KEY,
  reason TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_stats (
  video_id TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  captured_on DATE NOT NULL,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  PRIMARY KEY (video_id, captured_on)
);

CREATE TABLE IF NOT EXISTS extractions (
  video_id TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  prompt_version TEXT NOT NULL,
  guests JSONB NOT NULL DEFAULT '[]',
  topics JSONB NOT NULL DEFAULT '[]',
  brands JSONB NOT NULL DEFAULT '[]',
  method TEXT NOT NULL CHECK (method IN ('gemini', 'keyword')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, prompt_version)
);

CREATE TABLE IF NOT EXISTS topics_taxonomy (
  canonical_name TEXT PRIMARY KEY,
  aliases JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS guest_aliases (
  alias_key TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefs (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'failed')),
  payload_json JSONB,
  html TEXT,
  text_body TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('refresh', 'brief', 'check')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  units_used INTEGER NOT NULL DEFAULT 0,
  videos_fetched INTEGER NOT NULL DEFAULT 0,
  gemini_calls INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  stage TEXT,
  failures_json JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE runs ADD COLUMN IF NOT EXISTS notes_json JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS actions (
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_key)
);

CREATE TABLE IF NOT EXISTS seed_snapshot (
  id SERIAL PRIMARY KEY,
  payload_json JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('demo', 'captured', 'live')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  ip TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
