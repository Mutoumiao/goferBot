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
  // db.close() // 全局 db 连接不应在单个测试文件中关闭
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch { /* ignore */ }
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

  it('should reject empty name', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /knowledge-bases/:id', () => {
  it('should soft-delete a knowledge base and move directory to trash', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToDelete' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    expect(fs.existsSync(kb.path)).toBe(true)

    const delRes = await app.request(`/${kb.id}`, { method: 'DELETE' })
    expect(delRes.status).toBe(200)

    expect(fs.existsSync(kb.path)).toBe(false)

    const listRes = await app.request('/')
    const list = (await listRes.json()) as Array<{ name: string }>
    expect(list.find((k) => k.name === 'ToDelete')).toBeUndefined()
  })

  it('should return 404 for non-existent knowledge base', async () => {
    const res = await app.request('/nonexistent', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('should return 404 for already deleted knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AlreadyDeleted' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}`, { method: 'DELETE' })
    const res = await app.request(`/${kb.id}`, { method: 'DELETE' })
    expect(res.status).toBe(404)
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

  it('should auto-rename when name conflicts on restore', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Conflict' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}`, { method: 'DELETE' })

    // Re-create a KB with the same name to cause conflict
    await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Conflict' }),
    })

    const restoreRes = await app.request(`/${kb.id}/restore`, { method: 'POST' })
    expect(restoreRes.status).toBe(200)
    const restored = (await restoreRes.json()) as { name: string }
    expect(restored.name).toBe('Conflict-副本')
  })

  it('should return 404 for non-existent id', async () => {
    const res = await app.request('/nonexistent/restore', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('should return 404 for non-deleted knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NotDeleted' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/restore`, { method: 'POST' })
    expect(res.status).toBe(404)
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

  it('should list files and subdirectories', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ListFiles KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    fs.mkdirSync(path.join(kb.path, 'subdir'), { recursive: true })
    fs.writeFileSync(path.join(kb.path, 'notes.md'), '# Notes', 'utf-8')

    const res = await app.request(`/${kb.id}/files`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { items: Array<{ name: string; type: string }> }
    const names = json.items.map((i) => i.name).sort()
    expect(names).toEqual(['notes.md', 'subdir'])
    const fileItem = json.items.find((i) => i.name === 'notes.md')
    expect(fileItem?.type).toBe('file')
    const dirItem = json.items.find((i) => i.name === 'subdir')
    expect(dirItem?.type).toBe('directory')
  })

  it('should browse subdirectory with path query', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Subdir KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    fs.mkdirSync(path.join(kb.path, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(kb.path, 'docs', 'inner.md'), 'content', 'utf-8')

    const res = await app.request(`/${kb.id}/files?path=docs`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { path: string; items: Array<{ name: string }> }
    expect(json.path).toBe('docs')
    expect(json.items).toHaveLength(1)
    expect(json.items[0].name).toBe('inner.md')
  })

  it('should reject path traversal', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Traversal KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/files?path=../etc`)
    expect(res.status).toBe(400)
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

  it('should import files into a subdirectory', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SubdirImport KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    const res = await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'notes',
        files: [{ name: 'todo.txt', content: 'todo list' }],
      }),
    })

    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(kb.path, 'notes', 'todo.txt'))).toBe(true)
  })

  it('should reject file name path traversal', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TraversalImport KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '',
        files: [{ name: '../outside.txt', content: 'bad' }],
      }),
    })

    expect(res.status).toBe(400)
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

  it('should return empty results for empty query', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'EmptySearch KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/search?q=`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { results: [] }
    expect(json.results).toEqual([])
  })

  it('should return empty results for non-matching query', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NoMatch KB' }),
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

    const res = await app.request(`/${kb.id}/search?q=nonexistent`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { results: [] }
    expect(json.results).toEqual([])
  })

  it('should match across subdirectories', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DeepSearch KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    fs.mkdirSync(path.join(kb.path, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(kb.path, 'docs', 'readme.md'), 'hello', 'utf-8')

    const res = await app.request(`/${kb.id}/search?q=readme`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { results: Array<{ name: string; relativePath: string }> }
    expect(json.results.length).toBe(1)
    expect(json.results[0].name).toBe('readme.md')
    expect(json.results[0].relativePath).toBe('docs/readme.md')
  })
})
