import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startSidecar, stopSidecar } from '../setup'
import { startMockEmbeddingServer } from '../mocks/embedding-server'
import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(__dirname, '../../../server/src/index.ts'))
const Database = require('better-sqlite3')

let mockEmbeddingServer: any
let mockEmbeddingPort: number

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      server.close(() => resolve(port))
    })
  })
}

beforeAll(async () => {
  mockEmbeddingPort = await getAvailablePort()
  mockEmbeddingServer = startMockEmbeddingServer(mockEmbeddingPort)
})

afterAll(() => {
  mockEmbeddingServer.close()
})

async function configureMockEmbedding(sidecarPort: number) {
  let lastErr: Error | undefined
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + sidecarPort + '/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: {
            openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
            claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
            deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
            custom: { apiKey: '', model: '', baseUrl: '' },
            ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
          },
          embeddingProvider: {
            provider: 'openai',
            apiKey: 'mock-api-key',
            model: 'text-embedding-3-small',
            baseUrl: 'http://127.0.0.1:' + mockEmbeddingPort,
          },
          temperature: 0.7,
          defaultChatProvider: 'deepseek',
        }),
      })
      expect(res.status).toBe(200)
      return
    } catch (err) {
      lastErr = err as Error
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw lastErr ?? new Error('Failed to configure mock embedding')
}

async function createKB(port: number, name: string): Promise<string> {
  const res = await fetch('http://127.0.0.1:' + port + '/knowledge-bases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  expect(res.status).toBe(201)
  const data = await res.json()
  return data.id as string
}

async function importFile(port: number, kbId: string, fileName: string, content: string, relativePath = ''): Promise<void> {
  const res = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kbId + '/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: relativePath,
      files: [{ name: fileName, content }],
    }),
  })
  expect(res.status).toBe(200)
}

async function waitForIndexing(port: number, kbId: string, timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const res = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kbId + '/index-status')
    const status = (await res.json()) as { pendingFiles: number; indexedFiles: number; totalFiles: number }
    if (status.pendingFiles === 0 && status.indexedFiles >= status.totalFiles && status.totalFiles > 0) {
      await new Promise((r) => setTimeout(r, 300))
      return
    }
    if (status.pendingFiles === 0 && status.totalFiles === 0) {
      return
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Timeout waiting for indexing')
}

function queryDb(dataDir: string, sql: string, params: unknown[] = []): unknown[] {
  const db = new Database(join(dataDir, 'sidecar.db'))
  try {
    // Load sqlite-vec extension so vec_document_chunks virtual table is accessible
    try {
      const serverNodeModules = join(__dirname, '..', '..', '..', 'server', 'node_modules')
      const sqliteVecPath = require.resolve('sqlite-vec', { paths: [serverNodeModules] })
      const sqliteVec = require(sqliteVecPath)
      sqliteVec.load(db)
    } catch {
      // extension may not be available from test context
    }
    return db.prepare(sql).all(...params)
  } finally {
    db.close()
  }
}

function getChunks(dataDir: string, kbId: string): Array<{ id: string; file_path: string; content: string }> {
  return queryDb(
    dataDir,
    'SELECT id, file_path, content FROM document_chunks WHERE knowledge_base_id = ? ORDER BY chunk_index',
    [kbId]
  ) as Array<{ id: string; file_path: string; content: string }>
}

function getVecChunks(dataDir: string, chunkIds: string[]): Array<{ chunk_id: string; embedding: string }> {
  if (chunkIds.length === 0) return []
  const placeholders = chunkIds.map(() => '?').join(',')
  return queryDb(
    dataDir,
    'SELECT chunk_id, embedding FROM vec_document_chunks WHERE chunk_id IN (' + placeholders + ')',
    chunkIds
  ) as Array<{ chunk_id: string; embedding: string }>
}

describe('index synchronization after file operations', () => {
  describe('TC-04b-001~004: cross-KB move', () => {
    it('TC-04b-001: moving file across KB updates index (old KB chunks cleared, new KB has chunks)', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'test.txt', 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega')
        await waitForIndexing(port, kbA)

        const chunksA = getChunks(dataDir, kbA)
        expect(chunksA.length).toBeGreaterThan(0)
        const chunksB = getChunks(dataDir, kbB)
        expect(chunksB.length).toBe(0)

        const moveRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'test.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        expect(moveRes.status).toBe(200)
        await waitForIndexing(port, kbB)

        const chunksAfterA = getChunks(dataDir, kbA)
        expect(chunksAfterA.length).toBe(0)

        const chunksAfterB = getChunks(dataDir, kbB)
        expect(chunksAfterB.length).toBeGreaterThan(0)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-002: old KB retrieval no longer returns moved file content', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'secret.txt', 'The quick brown fox jumps over the lazy dog repeatedly to ensure enough text for chunking. The quick brown fox jumps over the lazy dog.')
        await waitForIndexing(port, kbA)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'secret.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        await waitForIndexing(port, kbB)

        const chunksA = getChunks(dataDir, kbA)
        expect(chunksA.some((c) => c.content.includes('quick brown fox'))).toBe(false)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-003: new KB retrieval returns moved file content', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'secret.txt', 'The quick brown fox jumps over the lazy dog repeatedly to ensure enough text for chunking. The quick brown fox jumps over the lazy dog.')
        await waitForIndexing(port, kbA)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'secret.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        await waitForIndexing(port, kbB)

        const chunksB = getChunks(dataDir, kbB)
        expect(chunksB.some((c) => c.content.includes('quick brown fox'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-004: file system consistency after move', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'move-me.txt', 'Some content here for the file system consistency test. It needs to be long enough. Some content here for the file system consistency test.')
        await waitForIndexing(port, kbA)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'move-me.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        await waitForIndexing(port, kbB)

        const kbAPath = join(dataDir, 'docs', 'KB-A')
        const kbBPath = join(dataDir, 'docs', 'KB-B')
        expect(existsSync(join(kbAPath, 'move-me.txt'))).toBe(false)
        expect(existsSync(join(kbBPath, 'move-me.txt'))).toBe(true)
        expect(readFileSync(join(kbBPath, 'move-me.txt'), 'utf-8')).toContain('file system consistency test')
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })
  })

  describe('TC-04b-005~008: cross-KB copy', () => {
    it('TC-04b-005: copying file across KB updates index (both KBs have chunks)', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'copy.txt', 'Copy this text across knowledge bases. Copy this text across knowledge bases. Copy this text across knowledge bases. Copy this text across knowledge bases.')
        await waitForIndexing(port, kbA)

        const copyRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'copy.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        expect(copyRes.status).toBe(200)
        await waitForIndexing(port, kbB)

        const chunksA = getChunks(dataDir, kbA)
        const chunksB = getChunks(dataDir, kbB)
        expect(chunksA.length).toBeGreaterThan(0)
        expect(chunksB.length).toBeGreaterThan(0)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-006: both KBs can retrieve copied content', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'dual.txt', 'Content that should exist in both knowledge bases after copy. Content that should exist in both knowledge bases after copy. Content that should exist in both knowledge bases after copy.')
        await waitForIndexing(port, kbA)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'dual.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        await waitForIndexing(port, kbB)

        const chunksA = getChunks(dataDir, kbA)
        const chunksB = getChunks(dataDir, kbB)
        expect(chunksA.some((c) => c.content.includes('both knowledge bases'))).toBe(true)
        expect(chunksB.some((c) => c.content.includes('both knowledge bases'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-007: file system consistency after copy', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'copy-fs.txt', 'File system consistency for copy. File system consistency for copy. File system consistency for copy. File system consistency for copy.')
        await waitForIndexing(port, kbA)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'copy-fs.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        await waitForIndexing(port, kbB)

        const kbAPath = join(dataDir, 'docs', 'KB-A')
        const kbBPath = join(dataDir, 'docs', 'KB-B')
        expect(existsSync(join(kbAPath, 'copy-fs.txt'))).toBe(true)
        expect(existsSync(join(kbBPath, 'copy-fs.txt'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-008: copy same-name file conflict handling', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'conflict.txt', 'Original conflict file content. Original conflict file content. Original conflict file content. Original conflict file content.')
        await importFile(port, kbB, 'conflict.txt', 'Existing conflict file content. Existing conflict file content. Existing conflict file content. Existing conflict file content.')
        await waitForIndexing(port, kbA)
        await waitForIndexing(port, kbB)

        const copyRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'conflict.txt',
            targetKbId: kbB,
            targetPath: '',
          }),
        })
        expect(copyRes.status).toBe(200)
        const copyBody = (await copyRes.json()) as { name: string }
        expect(copyBody.name).not.toBe('conflict.txt')
        expect(copyBody.name).toMatch(/conflict\(\d+\)\.txt/)

        await waitForIndexing(port, kbB)

        const kbBPath = join(dataDir, 'docs', 'KB-B')
        expect(existsSync(join(kbBPath, 'conflict.txt'))).toBe(true)
        expect(existsSync(join(kbBPath, copyBody.name))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })
  })

  describe('TC-04b-009~012: KB rename', () => {
    it('TC-04b-009: KB rename preserves index', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'OldKB')
        await importFile(port, kb, 'preserve.txt', 'Index preservation test. Index preservation test. Index preservation test. Index preservation test. Index preservation test.')
        await waitForIndexing(port, kb)

        const before = getChunks(dataDir, kb)
        expect(before.length).toBeGreaterThan(0)

        const renameRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'NewKB' }),
        })
        expect(renameRes.status).toBe(200)

        const after = getChunks(dataDir, kb)
        expect(after.length).toBe(before.length)
        expect(after.map((c) => c.content)).toEqual(before.map((c) => c.content))
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-010: file system consistency after KB rename', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'OldKB')
        await importFile(port, kb, 'fs-check.txt', 'File system consistency after KB rename. File system consistency after KB rename. File system consistency after KB rename.')
        await waitForIndexing(port, kb)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'NewKB' }),
        })

        const oldPath = join(dataDir, 'docs', 'OldKB')
        const newPath = join(dataDir, 'docs', 'NewKB')
        expect(existsSync(oldPath)).toBe(false)
        expect(existsSync(newPath)).toBe(true)
        expect(existsSync(join(newPath, 'fs-check.txt'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-011: config references updated (DB path updated)', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'OldKB')
        await importFile(port, kb, 'config-check.txt', 'Config references updated. Config references updated. Config references updated. Config references updated.')
        await waitForIndexing(port, kb)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'NewKB' }),
        })

        const kbRow = queryDb(dataDir, 'SELECT path FROM knowledge_bases WHERE id = ?', [kb])[0] as { path: string }
        expect(kbRow.path).toContain('NewKB')
        expect(kbRow.path).not.toContain('OldKB')
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-012: boundary empty name / long name handling', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'BoundaryKB')

        const emptyRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '   ' }),
        })
        expect(emptyRes.status).toBe(200)
        const emptyBody = await emptyRes.json()
        expect(emptyBody.name).toBe('BoundaryKB')

        const longName = 'A'.repeat(200)
        const longRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: longName }),
        })
        expect(longRes.status).toBe(200)
        const longBody = await longRes.json()
        expect(longBody.name).toBe(longName)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })
  })

  describe('TC-04b-013~016: file rename', () => {
    it('TC-04b-013: file rename updates index', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'RenameKB')
        await importFile(port, kb, 'old-name.txt', 'File rename updates index test. File rename updates index test. File rename updates index test. File rename updates index test.')
        await waitForIndexing(port, kb)

        const before = getChunks(dataDir, kb)
        expect(before.every((c) => c.file_path === 'old-name.txt')).toBe(true)

        const renameRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files/old-name.txt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'new-name' }),
        })
        expect(renameRes.status).toBe(200)

        const after = getChunks(dataDir, kb)
        expect(after.every((c) => c.file_path === 'new-name.txt')).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-014: content still retrievable after rename', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'RenameKB')
        await importFile(port, kb, 'retrievable.txt', 'Content still retrievable after rename. Content still retrievable after rename. Content still retrievable after rename. Content still retrievable after rename.')
        await waitForIndexing(port, kb)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files/retrievable.txt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'still-here' }),
        })

        const after = getChunks(dataDir, kb)
        expect(after.some((c) => c.content.includes('Content still retrievable'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-015: file system consistency after file rename', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'RenameKB')
        await importFile(port, kb, 'fs-rename.txt', 'File system consistency after file rename. File system consistency after file rename. File system consistency after file rename.')
        await waitForIndexing(port, kb)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files/fs-rename.txt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'fs-renamed' }),
        })

        const kbPath = join(dataDir, 'docs', 'RenameKB')
        expect(existsSync(join(kbPath, 'fs-rename.txt'))).toBe(false)
        expect(existsSync(join(kbPath, 'fs-renamed.txt'))).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-016: boundary invalid name handling', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'RenameKB')
        await importFile(port, kb, 'invalid-test.txt', 'Invalid name handling test. Invalid name handling test. Invalid name handling test. Invalid name handling test.')
        await waitForIndexing(port, kb)

        const emptyRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files/invalid-test.txt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: '   ' }),
        })
        expect(emptyRes.status).toBe(400)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })
  })

  describe('TC-04b-017~020: edge cases', () => {
    it('TC-04b-017: vec data not recalculated when content unchanged', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'EdgeKB')
        await importFile(port, kb, 'vec-check.txt', 'Vec data not recalculated when content unchanged. Vec data not recalculated when content unchanged. Vec data not recalculated when content unchanged.')
        await waitForIndexing(port, kb)

        const before = getChunks(dataDir, kb)
        const beforeIds = before.map((c) => c.id)
        const beforeVec = getVecChunks(dataDir, beforeIds)
        expect(beforeVec.length).toBeGreaterThan(0)

        await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files/vec-check.txt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: 'vec-check-renamed' }),
        })

        const after = getChunks(dataDir, kb)
        const afterIds = after.map((c) => c.id)
        expect(afterIds).toEqual(beforeIds)

        const afterVec = getVecChunks(dataDir, afterIds)
        expect(afterVec.length).toBe(beforeVec.length)
        for (let i = 0; i < beforeVec.length; i++) {
          expect(afterVec[i].embedding).toStrictEqual(beforeVec[i].embedding)
        }
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-018: queue enqueue parameters correct', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kbA = await createKB(port, 'KB-A')
        const kbB = await createKB(port, 'KB-B')
        await importFile(port, kbA, 'queue-check.txt', 'Queue enqueue parameters correct. Queue enqueue parameters correct. Queue enqueue parameters correct. Queue enqueue parameters correct.')
        await waitForIndexing(port, kbA)

        const moveRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceKbId: kbA,
            sourcePath: 'queue-check.txt',
            targetKbId: kbB,
            targetPath: 'subfolder',
          }),
        })
        expect(moveRes.status).toBe(200)
        await waitForIndexing(port, kbB)

        const chunksB = getChunks(dataDir, kbB)
        expect(chunksB.length).toBeGreaterThan(0)
        expect(chunksB.every((c) => c.file_path === 'subfolder/queue-check.txt')).toBe(true)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-019: no error when no indexed files', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'EmptyKB')

        const rebuildRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/index', {
          method: 'POST',
        })
        expect(rebuildRes.status).toBe(200)
        const rebuildBody = (await rebuildRes.json()) as { success: boolean; queued: boolean }
        expect(rebuildBody.success).toBe(true)
        expect(rebuildBody.queued).toBe(true)

        const renameRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'RenamedEmpty' }),
        })
        expect(renameRes.status).toBe(200)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })

    it('TC-04b-020: batch operation consistency', async () => {
      const { port, dataDir, process: sidecarProc } = await startSidecar()
      try {
        await configureMockEmbedding(port)
        const kb = await createKB(port, 'BatchKB')

        const res = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '',
            files: [
              { name: 'batch1.txt', content: 'Batch operation consistency file one. Batch operation consistency file one. Batch operation consistency file one.' },
              { name: 'batch2.txt', content: 'Batch operation consistency file two. Batch operation consistency file two. Batch operation consistency file two.' },
              { name: 'batch3.txt', content: 'Batch operation consistency file three. Batch operation consistency file three. Batch operation consistency file three.' },
            ],
          }),
        })
        expect(res.status).toBe(200)
        const body = (await res.json()) as { imported: number }
        expect(body.imported).toBe(3)

        await waitForIndexing(port, kb)

        const chunks = getChunks(dataDir, kb)
        const paths = [...new Set(chunks.map((c) => c.file_path))].sort()
        expect(paths).toEqual(['batch1.txt', 'batch2.txt', 'batch3.txt'])

        const statusRes = await fetch('http://127.0.0.1:' + port + '/knowledge-bases/' + kb + '/index-status')
        const status = (await statusRes.json()) as { indexedFiles: number; totalFiles: number }
        expect(status.indexedFiles).toBe(3)
        expect(status.totalFiles).toBe(3)
      } finally {
        await stopSidecar(sidecarProc, dataDir)
      }
    })
  })
})
