/**
 * FolderController 集成测试
 * 覆盖端点：GET /api/knowledge-bases/:kbId/folders, POST /api/knowledge-bases/:kbId/folders,
 *          PATCH /api/knowledge-bases/:kbId/folders/:folderId, DELETE /api/knowledge-bases/:kbId/folders/:folderId
 * 场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { createIpGenerator } from './helpers/test-utils.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

const nextIp = createIpGenerator(12)

describe('FolderController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  let userId: string
  let kbId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('folder_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `folder-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Folder Test',
    }, { remoteAddress: nextIp() })
    userId = user.id
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' }, { remoteAddress: nextIp() })

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test KB', description: 'For folder tests' },
    })
    kbId = kbRes.json().data.id
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases/:kbId/folders', () => {
    it('AC-26: returns folder list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    it('AC-27: returns 404 for non-existent kb', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases/non-existent-kb/folders',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-28: returns 403 for other user kb', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other',
      }, { remoteAddress: nextIp() })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' }, { remoteAddress: nextIp() })

      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other KB' },
      })
      const otherKbId = otherKbRes.json().data.id

      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${otherKbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('AC-29: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/folders`,
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/knowledge-bases/:kbId/folders', () => {
    it('AC-30: creates folder with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Folder' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New Folder')
      expect(body.data.kbId).toBe(kbId)
    })

    it('AC-31: creates subfolder with parentId', async () => {
      const parentRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Parent Folder' },
      })
      const parentId = parentRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child Folder', parentId },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.parentId).toBe(parentId)
    })

    it('AC-32: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-33: returns 400 for invalid parentId format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test', parentId: 'not-uuid' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-34: returns 404 for non-existent parentId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test', parentId: '00000000-0000-0000-0000-000000000000' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-35: returns 404 for non-existent kb', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb/folders',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-36: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        payload: { name: 'Test' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('PATCH /api/knowledge-bases/:kbId/folders/:folderId', () => {
    it('AC-37: updates folder name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Old Name' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated Name')
    })

    it('AC-38: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Rename Test' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-39: returns 404 for non-existent folder', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/non-existent-folder`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-40: returns 403 for other user kb', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other2-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other2',
      }, { remoteAddress: nextIp() })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' }, { remoteAddress: nextIp() })

      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other KB 2' },
      })
      const otherKbId = otherKbRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${otherKbId}/folders/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /api/knowledge-bases/:kbId/folders/:folderId', () => {
    it('AC-41: deletes folder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'To Delete' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-42: returns 404 for non-existent folder', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/non-existent-folder`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-43: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/some-id`,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
