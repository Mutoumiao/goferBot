// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-api-test-${Date.now()}`)
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

beforeEach(() => {
  db.exec('DELETE FROM knowledge_bases')
})

describe('GET /knowledge-bases', () => {
  it('should return an empty list initially', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('should list created knowledge bases', async () => {
    await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'List KB' }),
    })

    const res = await app.request('/')
    const json = (await res.json()) as Array<{ name: string }>
    expect(json.length).toBe(1)
    expect(json[0].name).toBe('List KB')
  })
})

describe('POST /knowledge-bases', () => {
  it('should create a knowledge base', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test KB' }),
    })

    expect(res.status).toBe(201)
    const json = (await res.json()) as { id: string; name: string; path: string }
    expect(json.name).toBe('Test KB')
    expect(json.id).toBeDefined()
    expect(json.path).toContain('Test KB')
  })

  it('should reject duplicate names', async () => {
    await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate' }),
    })

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate' }),
    })

    expect(res.status).toBe(409)
  })
})

describe('DELETE /knowledge-bases/:id', () => {
  it('should soft-delete a knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToDelete' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const delRes = await app.request(`/${kb.id}`, { method: 'DELETE' })
    expect(delRes.status).toBe(200)

    const listRes = await app.request('/')
    const list = (await listRes.json()) as Array<{ name: string }>
    expect(list.find((k) => k.name === 'ToDelete')).toBeUndefined()
  })
})

describe('POST /knowledge-bases/:id/restore', () => {
  it('should restore a deleted knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToRestore' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}`, { method: 'DELETE' })
    const restoreRes = await app.request(`/${kb.id}/restore`, { method: 'POST' })
    expect(restoreRes.status).toBe(200)

    const listRes = await app.request('/')
    const list = (await listRes.json()) as Array<{ name: string }>
    expect(list.find((k) => k.name === 'ToRestore')).toBeDefined()
  })
})

describe('GET /knowledge-bases/:id/files', () => {
  it('should return empty directory for a new knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Files KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/files`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { items: [] }
    expect(json.items).toEqual([])
  })
})

describe('POST /knowledge-bases/:id/files', () => {
  it('should import files into a knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Import KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '',
        files: [{ name: 'hello.md', content: '# Hello' }],
      }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { imported: number }
    expect(json.imported).toBe(1)
  })
})

describe('GET /knowledge-bases/:id/search', () => {
  it('should find imported files by name', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Search KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '',
        files: [{ name: 'notes.md', content: 'content' }],
      }),
    })

    const res = await app.request(`/${kb.id}/search?q=notes`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { results: Array<{ name: string }> }
    expect(json.results.length).toBe(1)
    expect(json.results[0].name).toBe('notes.md')
  })
})
