/**
 * ZodValidationPipe 集成测试
 * 验证字段级错误返回
 * 场景：必填字段缺失、字符串格式错误、字符串过长、数值范围错误
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthFixtures, authHeader } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(15)

describe('ZodValidationPipe', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('zod_pipe')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(
      app,
      {
        email: `zod-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Zod Test',
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

  it('AC-12: returns 400 for missing required field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: authHeader(token),
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeInstanceOf(Array)
    const nameError = body.error.details.find((d: any) => d.field === 'name')
    expect(nameError).toBeDefined()
    // Zod 必填字段默认返回英文错误消息，验证 issue 存在即可
    expect(nameError.issue).toBeTruthy()
  })

  it('AC-13: returns 400 for invalid string format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/web/auth/register',
      payload: {
        email: 'not-an-email',
        encryptedPassword: 'valid-pwd-123',
        name: 'Test',
        invitationCode: 'GF-test-code-001',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const emailError = body.error.details.find((d: any) => d.field === 'email')
    expect(emailError).toBeDefined()
    expect(emailError.issue).toContain('邮箱')
  })

  it('AC-14: returns 400 for string too long', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: authHeader(token),
      payload: { title: 'a'.repeat(101) },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const titleError = body.error.details.find((d: any) => d.field === 'title')
    expect(titleError).toBeDefined()
    expect(titleError.issue).toContain('过长')
  })

  it('AC-15: returns 400 for invalid number range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/appearance',
      headers: authHeader(token),
      payload: {
        mode: 'light',
        fontSizeLevel: 10,
      },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const fontSizeError = body.error.details.find((d: any) => d.field === 'fontSizeLevel')
    expect(fontSizeError).toBeDefined()
    expect(fontSizeError.issue).toContain('范围')
  })
})
