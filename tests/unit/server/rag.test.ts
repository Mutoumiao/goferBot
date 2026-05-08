// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: db } = await import('../../../../server/src/db.js')
const { hybridSearch, buildRagPrompt } = await import('../../../../server/src/services/rag.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
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
        content,
        file_path,
        content='document_chunks',
        content_rowid='id'
      );
    `)
  } catch { /* FTS5 可能不可用 */ }
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM document_chunks')
  try { db.exec('DELETE FROM vec_document_chunks') } catch { /* ignore */ }
  try { db.exec('DELETE FROM fts_document_chunks') } catch { /* ignore */ }
})

describe('buildRagPrompt', () => {
  it('returns user query when no chunks', () => {
    const result = buildRagPrompt([], 'hello')
    expect(result).toBe('hello')
  })

  it('builds prompt with chunks', () => {
    const chunks = [
      { content: 'chunk one', filePath: 'a.md', score: 0.5 },
      { content: 'chunk two', filePath: 'b.md', score: 0.3 },
    ]
    const result = buildRagPrompt(chunks, 'query')
    expect(result).toContain('chunk one')
    expect(result).toContain('chunk two')
    expect(result).toContain('query')
    expect(result).toContain('a.md')
  })
})

describe('hybridSearch', () => {
  it('returns empty for empty kb list', async () => {
    const result = await hybridSearch('test', [], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test',
    })
    expect(result).toEqual([])
  })
})
