/**
 * KnowledgeBaseController 集成测试
 * 覆盖端点：GET /api/knowledge-bases, POST /api/knowledge-bases,
 *          PATCH /api/knowledge-bases/:id, DELETE /api/knowledge-bases/:id
 * 场景：happy path、Zod 验证失败、认证缺失/无效、权限不足、资源不存在
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(4)

describe('KnowledgeBaseController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('kb_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `kb-${Date.now()}@test.gofer`
    await AuthFixtures.createUser(
      app,
      { email, password: 'Test1234!', name: 'KB User' },
      { remoteAddress: nextIp() },
    )
    userToken = await AuthFixtures.loginAs(
      app,
      { email, password: 'Test1234!' },
      { remoteAddress: nextIp() },
    )
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases', () => {
    it('AC-67: returns KB list for authenticated user', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'My KB' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('AC-68: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-69: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-70a: returns only current user KBs from for-selector', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Selector KB' },
      })

      const otherEmail = `other-sel-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'OtherSel' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other Selector KB' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases/for-selector',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      const names = body.data.map((kb: any) => kb.name)
      expect(names).toContain('Selector KB')
      expect(names).not.toContain('Other Selector KB')
      body.data.forEach((kb: any) => {
        expect(kb).toHaveProperty('id')
        expect(kb).toHaveProperty('name')
        expect(typeof kb.fileCount).toBe('number')
      })
    })
  })

  describe('GET /api/knowledge-bases/for-selector', () => {
    it('AC-70b: returns pinned KBs first and limits to 100', async () => {
      // 先创建一个未置顶知识库
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Unpinned Selector KB' },
      })

      // 再创建并置顶一个知识库
      const pinnedRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Pinned Selector KB' },
      })
      const pinnedId = pinnedRes.json().data.id
      await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${pinnedId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { isPinned: true, sortOrder: 0 },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases/for-selector',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeLessThanOrEqual(100)
      expect(body.data[0].name).toBe('Pinned Selector KB')
    })
  })

  describe('POST /api/knowledge-bases', () => {
    it('AC-71: creates KB with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New KB', description: 'Description' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New KB')
    })

    it('AC-72: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-73: returns 400 for name > 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'a'.repeat(101) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-74: returns 400 for description > 500 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Valid Name', description: 'a'.repeat(501) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-75: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        payload: { name: 'New KB' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('PATCH /api/knowledge-bases/:id', () => {
    it('AC-76: updates KB for owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated KB' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated KB')
    })

    it('AC-77: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-78: returns 400 for negative sortOrder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { sortOrder: -1 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-79: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-80: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Owner KB' },
      })
      const kbId = createRes.json().data.id

      const otherEmail = `other2-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other2' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-81: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/knowledge-bases/non-existent-id',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/knowledge-bases/:id', () => {
    it('AC-82: deletes KB for owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-83: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-84: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Owner KB' },
      })
      const kbId = createRes.json().data.id

      const otherEmail = `other-del-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'OtherDel' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-85: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/knowledge-bases/non-existent-id',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
