import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import path from 'node:path'
import { getAppDataDir } from './utils.js'

const dbPath = path.join(getAppDataDir(), 'sidecar.db')
const db: BetterSqlite3.Database = new Database(dbPath)

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
    name TEXT NOT NULL,
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

// Migration: remove table-level UNIQUE constraint on knowledge_bases.name
// and replace with a partial unique index (only active / non-deleted rows)
function migrateKnowledgeBaseUniqueConstraint(): void {
  const indexes = db.prepare("PRAGMA index_list('knowledge_bases')").all() as Array<{
    name: string
    unique: number
    origin: string
  }>

  const autoUniqueIndex = indexes.find(
    (idx) => idx.unique === 1 && idx.origin === 'u'
  )
  if (autoUniqueIndex) {
    const cols = db
      .prepare(`PRAGMA index_info('${autoUniqueIndex.name}')`)
      .all() as Array<{ name: string }>
    if (cols.some((c) => c.name === 'name')) {
      db.exec(`
        CREATE TABLE knowledge_bases_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          deleted_at INTEGER,
          is_pinned INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0,
          icon TEXT DEFAULT 'mdi-database'
        );
        INSERT INTO knowledge_bases_new SELECT * FROM knowledge_bases;
        DROP TABLE knowledge_bases;
        ALTER TABLE knowledge_bases_new RENAME TO knowledge_bases;
      `)
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_name_active ON knowledge_bases(name) WHERE deleted_at IS NULL;
  `)
}

migrateKnowledgeBaseUniqueConstraint()

// document_chunks 原始表
const documentChunksSql = `
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  chunk_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
);
CREATE INDEX IF NOT EXISTS idx_chunks_kb ON document_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON document_chunks(knowledge_base_id, file_path);
`

try {
  db.exec(documentChunksSql)
} catch (e) {
  console.error('Failed to create document_chunks table:', e)
  throw e
}

// Migration: messages 表增加 knowledge_base_ids 列
try {
  db.exec(`ALTER TABLE messages ADD COLUMN knowledge_base_ids TEXT;`)
} catch { /* already exists */ }

export async function loadVectorExtensions(): Promise<void> {
  try {
    const sqliteVec = await import('sqlite-vec')
    sqliteVec.load(db)
    console.log('[db] sqlite-vec extension loaded')
  } catch (err) {
    console.error('[db] Failed to load sqlite-vec extension:', err)
  }
}

export default db
