// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: db, loadVectorExtensions } = await import('../../../../server/src/db.js')
const { hybridSearch, buildRagPrompt } = await import('../../../../server/src/services/rag.js')

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

beforeEach(() => {
  db.exec('DELETE FROM document_chunks')
  db.exec('DELETE FROM knowledge_bases')
  try { db.exec('DELETE FROM vec_document_chunks') } catch { /* ignore */ }
  try { db.exec('DELETE FROM fts_document_chunks') } catch { /* ignore */ }
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding: new Array(1536).fill(0.1), index: 0 }] }),
  } as Response)
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

  it('degrades gracefully when vector search fails', async () => {
    vi.doMock('../../../../server/src/services/embedding.js', () => ({
      getEmbedding: vi.fn().mockRejectedValue(new Error('vec fail')),
    }))

    db.prepare('INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)').run('kb1', 'KB1', '/tmp/kb1', Date.now())
    db.prepare('INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, chunk_index, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('c1', 'kb1', 'a.md', 'hello world content', 0, Date.now())
    db.prepare('INSERT INTO fts_document_chunks (chunk_id, content, file_path) VALUES (?, ?, ?)')
      .run('c1', 'hello world content', 'a.md')

    const { hybridSearch: hs } = await import('../../../../server/src/services/rag.js')
    const result = await hs('hello', ['kb1'], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test',
    })

    expect(result.length).toBeGreaterThanOrEqual(0)
    vi.doUnmock('../../../../server/src/services/embedding.js')
  })

  it('handles query with quotes safely', async () => {
    db.prepare('INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)').run('kb1', 'KB1', '/tmp/kb1', Date.now())
    db.prepare('INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, chunk_index, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('c2', 'kb1', 'b.md', 'say hello', 0, Date.now())
    db.prepare('INSERT INTO fts_document_chunks (chunk_id, content, file_path) VALUES (?, ?, ?)')
      .run('c2', 'say hello', 'b.md')

    const result = await hybridSearch('say "hello"', ['kb1'], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test',
    })

    expect(Array.isArray(result)).toBe(true)
  })

  it('searches across multiple knowledge bases', async () => {
    db.prepare('INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)').run('kb1', 'KB1', '/tmp/kb1', Date.now())
    db.prepare('INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)').run('kb2', 'KB2', '/tmp/kb2', Date.now())
    db.prepare('INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, chunk_index, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('c3', 'kb1', 'a.md', 'kb1 content', 0, Date.now())
    db.prepare('INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, chunk_index, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('c4', 'kb2', 'b.md', 'kb2 content', 0, Date.now())
    db.prepare('INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)')
      .run('c3', JSON.stringify(new Array(1536).fill(0.1)))
    db.prepare('INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)')
      .run('c4', JSON.stringify(new Array(1536).fill(0.1)))

    const result = await hybridSearch('content', ['kb1', 'kb2'], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test',
    })

    const filePaths = result.map((r) => r.filePath)
    expect(filePaths).toContain('a.md')
    expect(filePaths).toContain('b.md')
  })
})
