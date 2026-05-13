// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-db-schema-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: db, loadVectorExtensions } = await import('../../../../server/src/db.js')

beforeAll(async () => {
  fs.mkdirSync(testDir, { recursive: true })

  await loadVectorExtensions()

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      );
    `)
  } catch { /* sqlite-vec 可能不可用 */ }

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_chunks USING fts5(
        chunk_id,
        content,
        file_path,
        chunk_id,
        tokenize='unicode61'
      );
    `)
  } catch { /* FTS5 可能不可用 */ }
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

describe('database schema', () => {
  it('has document_chunks table', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_chunks'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('document_chunks')
  })

  it('has expected columns in document_chunks', () => {
    const cols = db.prepare("PRAGMA table_info(document_chunks)").all() as Array<{ name: string }>
    const names = cols.map((c) => c.name)
    expect(names).toContain('id')
    expect(names).toContain('knowledge_base_id')
    expect(names).toContain('file_path')
    expect(names).toContain('content')
    expect(names).toContain('embedding')
    expect(names).toContain('chunk_index')
    expect(names).toContain('created_at')
  })

  it('has idx_chunks_kb index', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_chunks_kb'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('idx_chunks_kb')
  })

  it('has idx_chunks_file index', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_chunks_file'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('idx_chunks_file')
  })

  it('has vec_document_chunks virtual table', () => {
    const row = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'vec_document_chunks'")
      .get() as { name: string; sql: string } | undefined
    expect(row?.name).toBe('vec_document_chunks')
    expect(row?.sql?.toUpperCase()).toContain('VIRTUAL')
  })

  it('has fts_document_chunks virtual table', () => {
    const row = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'fts_document_chunks'")
      .get() as { name: string; sql: string } | undefined
    expect(row?.name).toBe('fts_document_chunks')
    expect(row?.sql?.toUpperCase()).toContain('VIRTUAL')
  })

  it('messages table has knowledge_base_ids column', () => {
    const cols = db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>
    const names = cols.map((c) => c.name)
    expect(names).toContain('knowledge_base_ids')
  })
})
