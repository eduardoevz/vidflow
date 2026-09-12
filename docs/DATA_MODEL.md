# Data Model

SQLite via `better-sqlite3`, forward-only numbered migrations in
`database/migrations/*.sql`, applied at startup by a small migration runner
that tracks applied versions in a `schema_migrations` table.

## Normalization

The spec's `downloads` and `history` tables share almost all descriptive
fields (title, source, thumbnail, resolution, format, filesize). Rather than
duplicating those columns in both tables, they're factored into a shared
`media_items` table, referenced by both:

```sql
media_items (
  id INTEGER PRIMARY KEY,
  original_url TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,           -- e.g. "youtube", "generic"
  thumbnail_path TEXT,            -- local cached thumbnail, not a remote URL
  duration_seconds REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)

downloads (
  id INTEGER PRIMARY KEY,
  media_item_id INTEGER NOT NULL REFERENCES media_items(id),
  format_id TEXT NOT NULL,
  resolution TEXT,
  format TEXT NOT NULL,           -- container extension
  filesize INTEGER,               -- bytes; NULL if unknown
  filesize_is_estimate INTEGER NOT NULL DEFAULT 0,
  destination_path TEXT,
  status TEXT NOT NULL,           -- queued|analyzing|downloading|paused|merging|processing|completed|failed|cancelled
  progress_percent REAL NOT NULL DEFAULT 0,
  error_message TEXT,
  downloaded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)

history (
  id INTEGER PRIMARY KEY,
  media_item_id INTEGER NOT NULL REFERENCES media_items(id),
  download_id INTEGER REFERENCES downloads(id),
  local_path TEXT NOT NULL,
  resolution TEXT,
  format TEXT NOT NULL,
  filesize INTEGER,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
)

settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL             -- JSON-encoded value; typed access in settingsRepo
)
```

## Access Pattern

Each table has a thin repository (`downloadsRepo`, `historyRepo`,
`mediaItemsRepo`, `settingsRepo`) exposing typed methods (`insert`, `update`,
`findById`, `list(filter)`, etc.) — no raw SQL leaks outside
`electron/main/database`.

## Deletion Semantics

- "Eliminar del historial" → deletes only the `history` row (and the
  `media_items` row if nothing else references it). The file on disk is
  untouched.
- "Eliminar archivo del equipo" → a separate, explicitly confirmed action
  that deletes the file at `local_path` via the OS trash/recycle bin API
  where available, then also removes the `history` row.

These two actions are never exposed behind the same button or the same IPC
channel, to avoid the two being confused (spec §28).

## Thumbnails

Thumbnails are downloaded once and cached under
`app.getPath('userData')/thumbnails/<hash>.jpg` — `media_items.thumbnail_path`
stores the local path, not the (possibly expiring) remote URL. A periodic
cleanup removes cached thumbnails with no referencing `media_items` row.
