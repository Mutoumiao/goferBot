// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-indexer-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/knowledgeBases.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeAll(() => {
  // 在测试环境中确保虚拟表存在（测试不经过 index.ts 的启动流程）
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

beforeEach(() => {
  db.exec('DELETE FROM knowledge_bases')
  db.exec('DELETE FROM document_chunks')
  try { db.exec('DELETE FROM vec_document_chunks') } catch { /* ignore */ }
  try { db.exec('DELETE FROM fts_document_chunks') } catch { /* ignore */ }
})

describe('POST /knowledge-bases/:id/index', () => {
  it('returns 404 for non-existent kb', async () => {
    const res = await app.request('/nonexistent/index', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('queues reindex for existing kb', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Index KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    fs.writeFileSync(path.join(kb.path, 'test.txt'), 'Hello world this is a test document for indexing.', 'utf-8')

    const res = await app.request(`/${kb.id}/index`, { method: 'POST' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: boolean; queued: boolean }
    expect(json.success).toBe(true)
    expect(json.queued).toBe(true)
  })
})

describe('GET /knowledge-bases/:id/index-status', () => {
  it('returns status for empty kb', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Status KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/index-status`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { totalFiles: number; indexedFiles: number; pendingFiles: number }
    expect(json.totalFiles).toBe(0)
    expect(json.indexedFiles).toBe(0)
    expect(json.pendingFiles).toBeGreaterThanOrEqual(0)
  })
})
