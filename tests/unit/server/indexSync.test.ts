// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-index-sync-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/knowledgeBases.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      );
    `)
  } catch { /* sqlite-vec may not be available */ }
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_chunks USING fts5(
        content,
        file_path,
        chunk_id,
        tokenize='unicode61'
      );
    `)
  } catch { /* FTS5 may not be available */ }
})

afterAll(() => {
  db.close()
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  db.exec('DELETE FROM document_chunks')
  db.exec('DELETE FROM knowledge_bases')
  try { db.exec('DELETE FROM vec_document_chunks') } catch { /* ignore */ }
  try { db.exec('DELETE FROM fts_document_chunks') } catch { /* ignore */ }
})

function insertFakeChunk(kbId: string, filePath: string, content: string): string {
  const id = `chunk-${Math.random().toString(36).slice(2)}`
  db.prepare(
    `INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, embedding, chunk_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, kbId, filePath, content, null, 0, Date.now())
  try {
    db.prepare(`INSERT INTO fts_document_chunks (chunk_id, content, file_path) VALUES (?, ?, ?)`)
      .run(id, content, filePath)
  } catch { /* ignore */ }
  return id
}

describe('POST /move', () => {
  it('should remove source index and queue target index after move', async () => {
    const srcRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoveSrc' }),
    })
    const srcKb = (await srcRes.json()) as { id: string }

    const dstRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoveDst' }),
    })
    const dstKb = (await dstRes.json()) as { id: string }

    await app.request(`/${srcKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'move.md', content: '# Move' }] }),
    })
    insertFakeChunk(srcKb.id, 'move.md', 'move content')

    const beforeSrc = db.prepare('SELECT COUNT(*) as c FROM document_chunks WHERE knowledge_base_id = ?').get(srcKb.id) as { c: number }
    expect(beforeSrc.c).toBe(1)

    const res = await app.request('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'move.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })
    expect(res.status).toBe(200)

    const afterSrc = db.prepare('SELECT COUNT(*) as c FROM document_chunks WHERE knowledge_base_id = ?').get(srcKb.id) as { c: number }
    expect(afterSrc.c).toBe(0)

    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'move.md')).toBeDefined()
  })
})

describe('POST /copy', () => {
  it('should queue target index after copy', async () => {
    const srcRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CopySrc' }),
    })
    const srcKb = (await srcRes.json()) as { id: string }

    const dstRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CopyDst' }),
    })
    const dstKb = (await dstRes.json()) as { id: string }

    await app.request(`/${srcKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'copy.md', content: '# Copy' }] }),
    })

    const res = await app.request('/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'copy.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })
    expect(res.status).toBe(200)

    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'copy.md')).toBeDefined()
  })
})

describe('PATCH /knowledge-bases/:id/files/:path', () => {
  it('should update document_chunks.file_path after file rename', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RenameIdx' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'old.md', content: '# Hello' }] }),
    })
    insertFakeChunk(kb.id, 'old.md', 'old content')

    const res = await app.request(`/${kb.id}/files/old.md`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'new' }),
    })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT file_path FROM document_chunks WHERE knowledge_base_id = ?').get(kb.id) as
      | { file_path: string }
      | undefined
    expect(row?.file_path).toBe('new.md')
  })
})

describe('PATCH /knowledge-bases/:id', () => {
  it('should not modify document_chunks.file_path on kb rename', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OldKb' }),
    })
    const kb = (await createRes.json()) as { id: string }

    insertFakeChunk(kb.id, 'notes.md', 'notes content')

    const patchRes = await app.request(`/${kb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewKb' }),
    })
    expect(patchRes.status).toBe(200)

    const row = db.prepare('SELECT file_path FROM document_chunks WHERE knowledge_base_id = ?').get(kb.id) as
      | { file_path: string }
      | undefined
    expect(row?.file_path).toBe('notes.md')
  })
})
