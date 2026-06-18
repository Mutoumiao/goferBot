/**
 * SessionController 集成测试
 * 覆盖端点：GET /api/sessions, GET /api/sessions/:id, POST /api/sessions,
 *          POST /api/sessions/:id/rename, DELETE /api/sessions/:id
 * 场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(10)

describe('SessionController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  let userId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('session_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(
      app,
      {
        email: `session-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Session Test',
      },
      { remoteAddress: nextIp() },
    )
    userId = user.id
    token = await AuthFixtures.loginAs(
      app,
      { email: user.email, password: 'Test1234!' },
      { remoteAddress: nextIp() },
    )
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/sessions', () => {
    it('AC-01: returns session list with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.items).toBeInstanceOf(Array)
      expect(body.data.pagination).toBeDefined()
    })

    it('AC-02: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /api/sessions/:id', () => {
    it('AC-03: returns session by id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Test Session' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.id).toBe(created.id)
      expect(body.data.title).toBe('Test Session')
    })

    it('AC-04: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/non-existent-id',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-05: returns 403 for other user session', async () => {
      const otherUser = await AuthFixtures.createUser(
        app,
        {
          email: `other-${Date.now()}@test.gofer`,
          password: 'Test1234!',
          name: 'Other',
        },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherUser.email, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Private Session' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toBeDefined()
    })

    it('AC-06: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/some-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/sessions', () => {
    it('AC-07: creates session with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Session', provider: 'openai', model: 'gpt-4' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.title).toBe('New Session')
      expect(body.data.provider).toBe('openai')
      expect(body.data.userId).toBe(userId)
    })

    it('AC-08: creates session with default title when empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.title).toBe('新对话')
    })

    it('AC-09: returns 400 for invalid title (too long)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'a'.repeat(101) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-10: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: { title: 'Test' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/sessions/:id/rename', () => {
    it('AC-11: renames session', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Old Name' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.title).toBe('New Name')
    })

    it('AC-12: returns 400 for empty title', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Rename Test' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-13: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/non-existent-id/rename',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Name' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-14: returns 403 for other user session', async () => {
      const otherUser = await AuthFixtures.createUser(
        app,
        {
          email: `other2-${Date.now()}@test.gofer`,
          password: 'Test1234!',
          name: 'Other2',
        },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherUser.email, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Private' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { title: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toBeDefined()
    })
  })

  describe('DELETE /api/sessions/:id', () => {
    it('AC-15: deletes session', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'To Delete' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-16: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/sessions/non-existent-id',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-17: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/sessions/some-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
