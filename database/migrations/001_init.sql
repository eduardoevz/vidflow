CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_url TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  thumbnail_path TEXT,
  duration_seconds REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  format_id TEXT NOT NULL,
  resolution TEXT,
  format TEXT NOT NULL,
  filesize INTEGER,
  filesize_is_estimate INTEGER NOT NULL DEFAULT 0,
  destination_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress_percent REAL NOT NULL DEFAULT 0,
  error_message TEXT,
  downloaded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  download_id INTEGER REFERENCES downloads(id) ON DELETE SET NULL,
  local_path TEXT NOT NULL,
  resolution TEXT,
  format TEXT NOT NULL,
  filesize INTEGER,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_media_item ON downloads(media_item_id);
CREATE INDEX IF NOT EXISTS idx_history_media_item ON history(media_item_id);
CREATE INDEX IF NOT EXISTS idx_history_downloaded_at ON history(downloaded_at);
