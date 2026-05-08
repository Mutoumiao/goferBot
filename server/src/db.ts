import Database from 'better-sqlite3'
import path from 'node:path'
import { getAppDataDir } from './utils.js'

const dbPath = path.join(getAppDataDir(), 'sidecar.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

  CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
`)

// Migration: add is_pinned, sort_order, icon to knowledge_bases
try {
  db.exec(`ALTER TABLE knowledge_bases ADD COLUMN is_pinned INTEGER DEFAULT 0;`)
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE knowledge_bases ADD COLUMN sort_order INTEGER DEFAULT 0;`)
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE knowledge_bases ADD COLUMN icon TEXT DEFAULT 'mdi-database';`)
} catch { /* already exists */ }

export default db
