/**
 * ResponseInterceptor 集成测试
 * 验证统一响应格式 { data: T } 包装行为
 * 场景：对象响应、数组响应、删除响应、SSE 不包装
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(13)

describe('ResponseInterceptor', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('response_interceptor')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(
      app,
      {
        email: `resp-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Response Test',
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

  it('AC-03: wraps object response in { data: T }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // ResponseInterceptor 应自动包装为 { data: T }
    expect(body).toHaveProperty('data')
    expect(body.data).toBeDefined()
  })

  it('AC-04: wraps array response in { data: T }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body.data.items).toBeInstanceOf(Array)
  })

  it('AC-05: wraps delete response as { data: { deleted: true } }', async () => {
    // 先创建会话
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Delete Me' },
    })
    const sessionId = createRes.json().data.id

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleteRes.statusCode).toBe(200)
    const body = deleteRes.json()
    expect(body).toHaveProperty('data')
    expect(body.data.deleted).toBe(true)
  })

  it('AC-06: does not wrap @BypassResponse routes', async () => {
    // SSE 端点使用 @BypassResponse，应返回原始流
    // 先创建一个有效会话
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'SSE Test' },
    })
    const sessionId = sessionRes.json().data.id

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'test', sessionId },
    })
    // SSE 端点应设置 text/event-stream 头（即使后续可能因 mock 而报错）
    // 注意：app.inject() 对 SSE 的支持有限，至少验证不是 JSON 包装格式
    const contentType = res.headers['content-type']
    // 如果成功设置 SSE 头，则验证；否则验证响应不是 { data: ... } 格式
    if (contentType && contentType.includes('text/event-stream')) {
      expect(contentType).toContain('text/event-stream')
    } else {
      // app.inject() 可能无法完整处理 SSE，验证响应未被 ResponseInterceptor 包装
      const body = res.json()
      expect(body).not.toHaveProperty('data')
    }
  })
})
