CREATE TABLE IF NOT EXISTS agy_bookmarks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '未分类',
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  accent TEXT NOT NULL DEFAULT 'jade',
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS agy_bookmarks_url_active
ON agy_bookmarks(url) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS agy_bookmarks_public_updated
ON agy_bookmarks(visibility, deleted_at, is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS agy_bookmarks_category
ON agy_bookmarks(category, deleted_at);

CREATE TABLE IF NOT EXISTS agy_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
