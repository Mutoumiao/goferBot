/**
 * 文件夹跨 KB 移动/复制真实集成测试
 * 目标：验证跨 KB copy/move folder 后目标 KB 子树完整、storage/vector 隔离。
 * 依赖：真实 MinIO + pgvector（通过 checkInfrastructure 检测，关键服务不可用时自动跳过）。
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { checkInfrastructure } from './helpers/infra-check.js'
import {
  canDownloadStorage,
  hasEmbedding,
  uploadDocumentWithChunk,
} from './helpers/rag-test.helpers.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

describe('Folder Cross-KB Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let infraAvailable = false
  let userToken: string
  let sourceKbId: string

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.postgres && infraResult.minio
    if (!infraAvailable) {
      console.log('[FolderCrossKB] 基础设施不可用，跳过真实集成测试')
      console.log('[FolderCrossKB] 详情:', infraResult.details)
      return
    }

    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('folder_cross_kb')
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
    const email = `folder-cross-kb-${timestamp}@test.gofer`
    await AuthFixtures.createUser(
      app,
      { email, password: 'Test1234!', name: 'Folder Cross KB Tester' },
      { remoteAddress: nextIp() },
    )
    userToken = await AuthFixtures.loginAs(
      app,
      { email, password: 'Test1234!' },
      { remoteAddress: nextIp() },
    )

    const sourceKbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: `Source-KB-${timestamp}` },
    })
    sourceKbId = sourceKbRes.json().data.id
  })

  async function createTargetKb(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: `Target-KB-${Date.now()}` },
    })
    return res.json().data.id
  }

  async function createFolder(kbId: string, name: string, parentId?: string): Promise<string> {
    const payload: { name: string; parentId?: string } = { name }
    if (parentId) payload.parentId = parentId
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${userToken}` },
      payload,
    })
    return res.json().data.id
  }

  describe('POST /api/knowledge-bases/:kbId/folders/:folderId/copy', () => {
    it('AC-95: cross-KB copy folder keeps target subtree intact and storage isolated', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const targetKbId = await createTargetKb()

      const rootFolderId = await createFolder(sourceKbId, 'Source Root')
      const childFolderId = await createFolder(sourceKbId, 'Child', rootFolderId)
      const {
        docId: sourceDocId,
        chunkId: sourceChunkId,
        storageKey: sourceStorageKey,
      } = await uploadDocumentWithChunk(
        app,
        sourceKbId,
        userToken,
        'nested.txt',
        'Nested content',
        childFolderId,
      )

      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(true)
      expect(await hasEmbedding(prisma, sourceChunkId)).toBe(true)

      const copyRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${sourceKbId}/folders/${rootFolderId}/copy`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetKbId },
      })
      expect(copyRes.statusCode).toBe(200)
      const copiedRootId = copyRes.json().data.id
      expect(copyRes.json().data.kbId).toBe(targetKbId)

      const targetRootFolders = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${targetKbId}/folders`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(targetRootFolders.json().data).toHaveLength(1)
      expect(targetRootFolders.json().data[0].id).toBe(copiedRootId)
      expect(targetRootFolders.json().data[0].name).toBe('Source Root')

      const targetChildren = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${targetKbId}/folders?parentId=${copiedRootId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(targetChildren.json().data).toHaveLength(1)
      const copiedChildId = targetChildren.json().data[0].id
      expect(targetChildren.json().data[0].name).toBe('Child')

      const copiedDocs = await prisma.document.findMany({
        where: { kbId: targetKbId, folderId: copiedChildId },
      })
      expect(copiedDocs).toHaveLength(1)
      const copiedDoc = copiedDocs[0]
      expect(copiedDoc.storageKey.startsWith(targetKbId)).toBe(true)
      expect(copiedDoc.status).toBe('uploaded')
      expect(await canDownloadStorage(app, copiedDoc.storageKey)).toBe(true)

      // 删除源文件夹后，副本 storage 应仍然可访问，源 storage 被清理
      await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${sourceKbId}/folders/${rootFolderId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(false)
      expect(await canDownloadStorage(app, copiedDoc.storageKey)).toBe(true)

      // 源 chunk/vector 已随源文件夹删除被清理
      expect(await prisma.chunk.count({ where: { documentId: sourceDocId } })).toBe(0)
      expect(await hasEmbedding(prisma, sourceChunkId)).toBe(false)
    }, 60000)
  })

  describe('POST /api/knowledge-bases/:kbId/folders/:folderId/move', () => {
    it('AC-96: cross-KB move folder removes source subtree and recreates it in target KB', async () => {
      if (!infraAvailable) {
        console.log('[SKIP] 基础设施不可用')
        return
      }

      const prisma = app.get(PrismaService)
      const targetKbId = await createTargetKb()

      const rootFolderId = await createFolder(sourceKbId, 'Move Root')
      const childFolderId = await createFolder(sourceKbId, 'Move Child', rootFolderId)
      const {
        docId: sourceDocId,
        chunkId: sourceChunkId,
        storageKey: sourceStorageKey,
      } = await uploadDocumentWithChunk(
        app,
        sourceKbId,
        userToken,
        'move-nested.txt',
        'Move nested content',
        childFolderId,
      )

      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(true)
      expect(await hasEmbedding(prisma, sourceChunkId)).toBe(true)

      const moveRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${sourceKbId}/folders/${rootFolderId}/move`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetKbId },
      })
      expect(moveRes.statusCode).toBe(200)
      const movedRootId = moveRes.json().data.id
      expect(moveRes.json().data.kbId).toBe(targetKbId)

      const sourceRootFolders = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${sourceKbId}/folders`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(sourceRootFolders.json().data).toHaveLength(0)

      const targetRootFolders = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${targetKbId}/folders`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(targetRootFolders.json().data).toHaveLength(1)
      expect(targetRootFolders.json().data[0].id).toBe(movedRootId)

      const targetChildren = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${targetKbId}/folders?parentId=${movedRootId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(targetChildren.json().data).toHaveLength(1)
      const movedChildId = targetChildren.json().data[0].id

      const movedDocs = await prisma.document.findMany({
        where: { kbId: targetKbId, folderId: movedChildId },
      })
      expect(movedDocs).toHaveLength(1)
      const movedDoc = movedDocs[0]
      expect(movedDoc.storageKey.startsWith(targetKbId)).toBe(true)
      expect(await canDownloadStorage(app, movedDoc.storageKey)).toBe(true)

      // 原文档的 chunk/vector/storage 已被清理
      expect(await prisma.chunk.count({ where: { documentId: sourceDocId } })).toBe(0)
      expect(await hasEmbedding(prisma, sourceChunkId)).toBe(false)
      expect(await canDownloadStorage(app, sourceStorageKey)).toBe(false)
    }, 60000)
  })
})
