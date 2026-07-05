/**
 * KbCleanupService 真实集成测试
 * 目标：验证删除 KB/Folder/Document 时 RAG 相关数据（chunk 记录、向量、storage 文件）被完整清理。
 * 依赖：真实 MinIO + pgvector 环境（通过 checkInfrastructure 检测，不可用时自动跳过）。
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { StorageService } from '../../packages/server/src/processors/storage/storage.service.js'
import { AuthFixtures, authHeader } from './helpers/auth.fixtures.js'
import { checkInfrastructure } from './helpers/infra-check.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const VECTOR_DIMENSION = 1536

describe('KbCleanup Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let infraAvailable = false
  let userToken: string
  let kbId: string

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[KbCleanup] 基础设施不可用，跳过真实集成测试')
      console.log('[KbCleanup] 详情:', infraResult.details)
      return
    }

    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('kb_cleanup')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl, { realMode: true, mockQueue: true })
  }, 120000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  const nextIp = createIpGenerator(10)

  beforeEach(async () => {
    if (!infraAvailable) return

    const prisma = app.get(PrismaService)
    await prisma.$executeRaw`
      TRUNCATE TABLE chunks, documents, folders, knowledge_bases, users RESTART IDENTITY CASCADE
    `

    const timestamp = Date.now()
    const email = `kb-cleanup-${timestamp}@test.gofer`
    await AuthFixtures.createUser(
      app,
      { email, password: 'Test1234!', name: 'KB Cleanup Tester' },
      { remoteAddress: nextIp() },
    )
    userToken = await AuthFixtures.loginAs(
      app,
      { email, password: 'Test1234!' },
      { remoteAddress: nextIp() },
    )

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: authHeader(userToken),
      payload: { name: `Cleanup-KB-${timestamp}` },
    })
    kbId = kbRes.json().data.id
  })

  describe('DELETE /api/knowledge-bases/:kbId/documents/:docId', () => {
    it('AC-90: deleting a document removes its chunks, vectors and storage', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const { docId, chunkId, storageKey } = await uploadDocumentWithChunk(
        'doc-delete.txt',
        'Document delete test content',
      )

      // 前置条件：chunk 记录、向量、storage 文件均存在
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)
      expect(await hasEmbedding(prisma, chunkId)).toBe(true)
      expect(await canDownloadStorage(app, storageKey)).toBe(true)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)

      // 后置条件：chunk 记录、向量、storage 文件均已清理
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(0)
      expect(await hasEmbedding(prisma, chunkId)).toBe(false)
      expect(await canDownloadStorage(app, storageKey)).toBe(false)
    }, 30000)
  })

  describe('DELETE /api/knowledge-bases/:kbId/folders/:folderId', () => {
    it('AC-91: deleting a folder removes nested document chunks, vectors and storage', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)

      const folderRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: authHeader(userToken),
        payload: { name: 'Cleanup Folder' },
      })
      const folderId = folderRes.json().data.id

      const { docId, chunkId, storageKey } = await uploadDocumentWithChunk(
        'folder-doc.txt',
        'Folder cleanup test content',
        folderId,
      )

      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)
      expect(await hasEmbedding(prisma, chunkId)).toBe(true)
      expect(await canDownloadStorage(app, storageKey)).toBe(true)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)

      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(0)
      expect(await hasEmbedding(prisma, chunkId)).toBe(false)
      expect(await canDownloadStorage(app, storageKey)).toBe(false)
    }, 30000)
  })

  describe('DELETE /api/knowledge-bases/:kbId', () => {
    it('AC-92: deleting a knowledge base removes all document chunks, vectors and storage', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const { docId, chunkId, storageKey } = await uploadDocumentWithChunk(
        'kb-doc.txt',
        'KB cleanup test content',
      )

      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)
      expect(await hasEmbedding(prisma, chunkId)).toBe(true)
      expect(await canDownloadStorage(app, storageKey)).toBe(true)

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)

      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(0)
      expect(await hasEmbedding(prisma, chunkId)).toBe(false)
      expect(await canDownloadStorage(app, storageKey)).toBe(false)
    }, 30000)
  })

  describe('Copy isolation', () => {
    it('AC-93: deleting source document after copy does not affect the copy', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const { docId: sourceDocId, storageKey: sourceStorageKey } = await uploadDocumentWithChunk(
        'source-copy.txt',
        'Source copy isolation content',
      )

      const copyRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${sourceDocId}/copy`,
        headers: authHeader(userToken),
        payload: { targetFolderId: null },
      })
      expect(copyRes.statusCode).toBe(200)
      const copiedDocId = copyRes.json().data.id
      const copiedStorageKey = copyRes.json().data.storageKey

      // 副本应使用独立的 storageKey
      expect(copiedStorageKey).not.toBe(sourceStorageKey)
      expect(await canDownloadStorage(app, copiedStorageKey)).toBe(true)

      // 删除源文档
      await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${sourceDocId}`,
        headers: authHeader(userToken),
      })

      // 源文档的 storage 应被清理，副本仍可下载
      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(false)
      expect(await canDownloadStorage(app, copiedStorageKey)).toBe(true)

      // 副本的数据库记录仍存在
      const copiedDoc = await prisma.document.findUnique({ where: { id: copiedDocId } })
      expect(copiedDoc).not.toBeNull()
    }, 30000)
  })

  describe('Cross-KB move cleanup', () => {
    it('AC-94: after cross-KB move, source storage and vectors are removed', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const targetKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: authHeader(userToken),
        payload: { name: `Target-KB-${Date.now()}` },
      })
      const targetKbId = targetKbRes.json().data.id

      const {
        docId,
        chunkId,
        storageKey: sourceStorageKey,
      } = await uploadDocumentWithChunk('cross-move.txt', 'Cross KB move cleanup content')

      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)
      expect(await hasEmbedding(prisma, chunkId)).toBe(true)
      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(true)

      const moveRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/move`,
        headers: authHeader(userToken),
        payload: { targetKbId },
      })
      expect(moveRes.statusCode).toBe(200)
      const newStorageKey = moveRes.json().data.storageKey

      // 文档已移动到目标 KB
      expect(moveRes.json().data.kbId).toBe(targetKbId)
      expect(newStorageKey.startsWith(targetKbId)).toBe(true)

      // 旧 chunk 记录与向量已清理
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(0)
      expect(await hasEmbedding(prisma, chunkId)).toBe(false)
      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(false)

      // 目标 KB 的 storage 文件存在
      expect(await canDownloadStorage(app, newStorageKey)).toBe(true)
    }, 30000)
  })

  // ---- helpers ----

  async function uploadDocumentWithChunk(
    filename: string,
    content: string,
    folderId?: string,
  ): Promise<{ docId: string; chunkId: string; storageKey: string }> {
    const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
    const multipartBody = buildMultipartBody(
      boundary,
      'file',
      filename,
      'text/plain',
      Buffer.from(content),
    )

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/upload`,
      headers: {
        ...authHeader(userToken),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    })
    expect(uploadRes.statusCode).toBe(201)

    const docId = uploadRes.json().data.id
    const storageKey = uploadRes.json().data.storageKey

    const prisma = app.get(PrismaService)
    const chunkId = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO chunks (id, document_id, kb_id, content, chunk_index, embedding)
      VALUES (
        ${chunkId}::uuid,
        ${docId}::uuid,
        ${kbId}::uuid,
        ${content},
        ${0},
        ${new Array(VECTOR_DIMENSION).fill(0.1)}::vector
      )
    `

    if (folderId) {
      await prisma.document.update({
        where: { id: docId },
        data: { folderId },
      })
    }

    return { docId, chunkId, storageKey }
  }

  async function hasEmbedding(prisma: PrismaService, chunkId: string): Promise<boolean> {
    const result = await prisma.$queryRaw`
      SELECT embedding IS NOT NULL as has_embedding
      FROM chunks
      WHERE id = ${chunkId}
    `
    return (result as Array<{ has_embedding: boolean }>)[0]?.has_embedding ?? false
  }

  async function canDownloadStorage(
    appInstance: NestFastifyApplication,
    key: string,
  ): Promise<boolean> {
    const storage = appInstance.get(StorageService)
    try {
      await storage.downloadFile(key)
      return true
    } catch {
      return false
    }
  }
})

function buildMultipartBody(
  boundary: string,
  fieldName: string,
  filename: string,
  contentType: string,
  buffer: Buffer,
): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([prefix, buffer, suffix])
}
