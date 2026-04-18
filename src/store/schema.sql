PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'mood', 'win', 'gratitude', 'question')),
  body TEXT NOT NULL,
  mood_score INTEGER,
  tags_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_journal_captured ON journal_entries(captured_at);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'snoozed', 'dropped')),
  due_at INTEGER,
  done_at INTEGER,
  snooze_until INTEGER,
  priority INTEGER NOT NULL DEFAULT 2
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, due_at);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stamp INTEGER NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('owner', 'photon')),
  body TEXT NOT NULL,
  attached INTEGER NOT NULL DEFAULT 0,
  ref_message_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_threads_stamp ON threads(stamp);

CREATE TABLE IF NOT EXISTS keyring (
  slot TEXT PRIMARY KEY,
  contents TEXT NOT NULL,
  touched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  body TEXT NOT NULL,
  fire_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sent','cancelled','failed')),
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_state ON scheduled_outbox(state, fire_at);

CREATE TABLE IF NOT EXISTS processed_message_ids (
  message_id TEXT PRIMARY KEY,
  stamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_checkins (
  token TEXT PRIMARY KEY,
  stamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS x_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL UNIQUE,
  user_id TEXT,
  filter TEXT,
  created_at INTEGER NOT NULL,
  last_checked_at INTEGER NOT NULL DEFAULT 0,
  last_seen_tweet_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_x_watches_last ON x_watches(last_checked_at);
