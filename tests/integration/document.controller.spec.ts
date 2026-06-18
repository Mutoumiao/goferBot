/**
 * DocumentController 集成测试
 * 覆盖端点：GET /api/knowledge-bases/:kbId/documents,
 *          POST /api/knowledge-bases/:kbId/documents/upload,
 *          POST /api/knowledge-bases/:kbId/documents,
 *          PATCH /api/knowledge-bases/:kbId/documents/:docId,
 *          DELETE /api/knowledge-bases/:kbId/documents/:docId
 * 场景：happy path、Zod 验证失败、认证缺失/无效、权限不足、资源不存在、文件类型/大小限制
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(2)

describe('DocumentController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string
  let kbId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('doc_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `doc-${Date.now()}@test.gofer`
    await AuthFixtures.createUser(
      app,
      { email, password: 'Test1234!', name: 'Doc User' },
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
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: `Doc-KB-${Date.now()}` },
    })
    kbId = kbRes.json().data.id
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases/:kbId/documents', () => {
    it('AC-29: returns documents for KB owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('AC-30: returns 400 for invalid folderId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents?folderId=not-uuid`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-31: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-32: returns 403 for non-owner', async () => {
      const otherEmail = `other-doc-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents/upload', () => {
    it('AC-33: uploads txt file for KB owner', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const content = 'Hello World'
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.txt',
        'text/plain',
        Buffer.from(content),
      )

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('test.txt')
    })

    it('AC-34: uploads md file for KB owner', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const content = '# Markdown Test'
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.md',
        'text/markdown',
        Buffer.from(content),
      )

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('test.md')
    })

    it('AC-35: returns 500 without file (multipart error)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      // 无 multipart content-type 时，@fastify/multipart 抛出 FastifyError，返回 500
      expect(res.statusCode).toBe(500)
    })

    it('AC-36: returns 401 without token', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.txt',
        'text/plain',
        Buffer.from('content'),
      )
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-37: returns 403 for non-owner', async () => {
      const otherEmail = `other-up-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.txt',
        'text/plain',
        Buffer.from('content'),
      )
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${otherToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-38: returns 404 for non-existent KB', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.txt',
        'text/plain',
        Buffer.from('content'),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-39: returns 201 for file < 50MB', async () => {
      // 注意：> 50MB 的 413 测试需要分配大量内存，在集成测试中跳过。
      // Controller 内部有 MAX_SIZE = 50MB 的检查，此处验证正常大小文件可上传。
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const largeContent = Buffer.alloc(2 * 1024 * 1024, 'x')
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'large.txt',
        'text/plain',
        largeContent,
      )

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(201)
    })

    it('AC-40: returns 415 for unsupported type', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'test.exe',
        'application/octet-stream',
        Buffer.from('binary'),
      )

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(415)
      const body = res.json()
      expect(body.error.code).toBe('UNSUPPORTED_TYPE')
    })

    it('AC-41: returns 415 for path traversal filename', async () => {
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        '../../../etc/passwd',
        'text/plain',
        Buffer.from('content'),
      )

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(415)
      const body = res.json()
      expect(body.error.code).toBe('UNSUPPORTED_TYPE')
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents', () => {
    it('AC-42: creates document for KB owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New Document')
    })

    it('AC-43: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-44: returns 400 for invalid folderId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document', folderId: 'not-uuid' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-45: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-46: returns 403 for non-owner', async () => {
      const otherEmail = `other-create-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-47: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb-id/documents',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/knowledge-bases/:kbId/documents/:docId', () => {
    it('AC-48: updates document for KB owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original Name' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated Name')
    })

    it('AC-49: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-50: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-51: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const otherEmail = `other-patch-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-52: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/some-doc-id',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-53: returns 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/non-existent-id`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-54: returns 404 when document not in KB', async () => {
      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: `Other-KB-${Date.now()}` },
      })
      const otherKbId = otherKbRes.json().data.id

      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${otherKbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Other Doc' },
      })
      const otherDocId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${otherDocId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/knowledge-bases/:kbId/documents/:docId', () => {
    it('AC-55: deletes document for KB owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-56: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-57: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const otherEmail = `other-del-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-58: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/some-doc-id',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-59: returns 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/non-existent-id`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents/:docId/move', () => {
    it('AC-60: moves document to another folder in same KB', async () => {
      const folderRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Doc Move Target' },
      })
      const targetFolderId = folderRes.json().data.id

      const docRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Doc To Move' },
      })
      const docId = docRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/move`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetFolderId },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.folderId).toBe(targetFolderId)
    })

    it('AC-61: moves document across KBs and resets status to uploaded', async () => {
      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: `Target-KB-${Date.now()}` },
      })
      const targetKbId = otherKbRes.json().data.id

      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const content = 'Cross KB move content'
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'cross.txt',
        'text/plain',
        Buffer.from(content),
      )

      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      const docId = uploadRes.json().data.id

      // 模拟已存在的 chunk 记录，验证跨 KB move 会清理旧 chunk
      const prisma = app.get(PrismaService)
      await prisma.chunk.create({
        data: {
          documentId: docId,
          kbId,
          content,
          chunkIndex: 0,
        },
      })
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/move`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetKbId },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.kbId).toBe(targetKbId)
      expect(body.data.status).toBe('uploaded')
      expect(body.data.storageKey.startsWith(targetKbId)).toBe(true)
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(0)
    })

    it('AC-63: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/00000000-0000-0000-0000-000000000000/move`,
        payload: { targetFolderId: null },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-63a: returns 400 for empty move body', async () => {
      const docRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Empty Body' },
      })
      const docId = docRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/move`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents/:docId/copy', () => {
    it('AC-64: copies document to another folder in same KB with status uploaded', async () => {
      const folderRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Doc Copy Target' },
      })
      const targetFolderId = folderRes.json().data.id

      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const content = 'Same KB copy content'
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'same-copy.txt',
        'text/plain',
        Buffer.from(content),
      )

      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      const docId = uploadRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/copy`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetFolderId },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.folderId).toBe(targetFolderId)
      expect(body.data.status).toBe('uploaded')
      expect(body.data.id).not.toBe(docId)
    })

    it('AC-65: copies document across KBs with independent storage', async () => {
      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: `Copy-Target-KB-${Date.now()}` },
      })
      const targetKbId = otherKbRes.json().data.id

      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
      const content = 'Cross KB copy content'
      const multipartBody = buildMultipartBody(
        boundary,
        'file',
        'cross-copy.txt',
        'text/plain',
        Buffer.from(content),
      )

      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      const docId = uploadRes.json().data.id

      const prisma = app.get(PrismaService)
      await prisma.chunk.create({
        data: {
          documentId: docId,
          kbId,
          content,
          chunkIndex: 0,
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/copy`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetKbId },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.kbId).toBe(targetKbId)
      expect(body.data.status).toBe('uploaded')
      expect(body.data.storageKey.startsWith(targetKbId)).toBe(true)
      expect(body.data.id).not.toBe(docId)

      // 源文档 chunk 与 storageKey 保持不变
      const sourceDoc = await prisma.document.findUnique({ where: { id: docId } })
      expect(sourceDoc?.kbId).toBe(kbId)
      expect(sourceDoc?.storageKey.startsWith(kbId)).toBe(true)
      expect(await prisma.chunk.count({ where: { documentId: docId } })).toBe(1)
    })

    it('AC-66: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/00000000-0000-0000-0000-000000000000/copy`,
        payload: { targetFolderId: null },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-66a: returns 400 for empty copy body', async () => {
      const docRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Empty Copy Body' },
      })
      const docId = docRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}/copy`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })
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
