// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-ext-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/knowledgeBases.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeEach(() => {
  db.exec('DELETE FROM knowledge_bases')
})

describe('PATCH /knowledge-bases/:id', () => {
  it('should rename knowledge base and update physical directory', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OldName' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    const patchRes = await app.request(`/${kb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewName' }),
    })

    expect(patchRes.status).toBe(200)
    const updated = (await patchRes.json()) as { name: string; path: string }
    expect(updated.name).toBe('NewName')
    expect(updated.path).toContain('NewName')
    expect(fs.existsSync(updated.path)).toBe(true)
    expect(fs.existsSync(kb.path)).toBe(false)
  })

  it('should update icon', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'IconTest' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const patchRes = await app.request(`/${kb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon: 'mdi-books' }),
    })

    expect(patchRes.status).toBe(200)
    const updated = (await patchRes.json()) as { icon: string }
    expect(updated.icon).toBe('mdi-books')
  })

  it('should toggle pin status', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PinTest' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const patchRes = await app.request(`/${kb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: 1 }),
    })

    expect(patchRes.status).toBe(200)
    const updated = (await patchRes.json()) as { is_pinned: number }
    expect(updated.is_pinned).toBe(1)
  })
})

describe('POST /knowledge-bases/:id/folders', () => {
  it('should create a folder in knowledge base', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'FolderKB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewFolder', path: '' }),
    })

    expect(res.status).toBe(201)
    const json = (await res.json()) as { name: string }
    expect(json.name).toBe('NewFolder')
  })

  it('should reject empty folder name', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'FolderKB2' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', path: '' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('PATCH /knowledge-bases/:id/files/:path', () => {
  it('should rename a file', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RenameKB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'old.md', content: '# Hello' }] }),
    })

    const res = await app.request(`/${kb.id}/files/old.md`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'new' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { name: string }
    expect(json.name).toBe('new.md')
  })

  it('should keep extension when renaming', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ExtKB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'test.txt', content: 'content' }] }),
    })

    const res = await app.request(`/${kb.id}/files/test.txt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'renamed' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { name: string }
    expect(json.name).toBe('renamed.txt')
  })
})

describe('POST /files/move', () => {
  it('should move file between knowledge bases', async () => {
    const srcRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SourceKB' }),
    })
    const srcKb = (await srcRes.json()) as { id: string }

    const dstRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DestKB' }),
    })
    const dstKb = (await dstRes.json()) as { id: string }

    await app.request(`/${srcKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'move-me.md', content: '# Move' }] }),
    })

    const res = await app.request('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'move-me.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })

    expect(res.status).toBe(200)

    // Verify file moved
    const srcFiles = await app.request(`/${srcKb.id}/files`)
    const srcJson = (await srcFiles.json()) as { items: Array<{ name: string }> }
    expect(srcJson.items.find((i) => i.name === 'move-me.md')).toBeUndefined()

    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'move-me.md')).toBeDefined()
  })
})

describe('POST /files/copy', () => {
  it('should copy file to another knowledge base with auto suffix on conflict', async () => {
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
      body: JSON.stringify({ path: '', files: [{ name: 'dup.md', content: '# A' }] }),
    })
    await app.request(`/${dstKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'dup.md', content: '# B' }] }),
    })

    const res = await app.request('/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'dup.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })

    expect(res.status).toBe(200)

    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'dup(1).md')).toBeDefined()
  })
})
