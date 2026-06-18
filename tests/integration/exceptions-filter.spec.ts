/**
 * AllExceptionsFilter 集成测试
 * 验证统一异常格式 { error: { code, message } }
 * 场景：400 验证错误、401 认证错误、404 资源不存在、403 权限不足、字段级错误详情
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(14)

describe('AllExceptionsFilter', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('exceptions_filter')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(
      app,
      {
        email: `filter-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Filter Test',
      },
      { remoteAddress: nextIp() },
    )
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

  it('AC-07: returns { error: { code, message } } for 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'invalid-email', encryptedPassword: '', name: '' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-08: returns { error: { code, message } } for 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
    expect(body.error.message).toBeDefined()
  })

  it('AC-09: returns { error: { code, message } } for 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/non-existent-id',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBeDefined()
  })

  it('AC-10: returns { error: { code, message } } for 403', async () => {
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
      payload: { title: 'Private' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.error.code).toBe('FORBIDDEN')
    expect(body.error.message).toBeDefined()
  })

  it('AC-11: returns { error: { code, message, details } } with field-level details for validation errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-email', encryptedPassword: '', name: '' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeInstanceOf(Array)
    expect(body.error.details.length).toBeGreaterThan(0)
    expect(body.error.details[0]).toHaveProperty('field')
    expect(body.error.details[0]).toHaveProperty('issue')
  })
})
