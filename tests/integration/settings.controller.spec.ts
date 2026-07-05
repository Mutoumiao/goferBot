/**
 * SettingsController 集成测试
 * 覆盖新的 provider-pool 架构下的用户只读端点：
 * - GET /api/settings
 * - GET /api/settings/:category
 * - GET /api/settings/:category/providers
 * - POST /api/settings/:category（仅 appearance 可写）
 *
 * 同时通过 ADMIN 端点播种 system_config，验证用户端读取结果。
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { AuthFixtures, adminAuthHeader, authHeader } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(20)

const openaiProvider = {
  id: 'openai',
  name: 'OpenAI',
  type: 'llm',
  enabled: true,
  model: 'gpt-4',
  apiKey: 'sk-test',
  baseUrl: '',
  timeoutMs: 300_000,
}

const claudeProvider = {
  id: 'claude',
  name: 'Claude',
  type: 'llm',
  enabled: true,
  model: 'claude-3',
  apiKey: 'sk-test',
  baseUrl: '',
  timeoutMs: 300_000,
}

const disabledProvider = {
  id: 'deepseek',
  name: 'DeepSeek',
  type: 'llm',
  enabled: false,
  model: 'deepseek-chat',
  apiKey: 'sk-test',
  baseUrl: '',
  timeoutMs: 300_000,
}

describe('SettingsController (provider-pool)', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('settings_pool')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const timestamp = Date.now()
    const adminEmail = `settings-admin-${timestamp}@test.gofer`
    const userEmail = `settings-user-${timestamp}@test.gofer`

    // 创建管理员并设置角色
    await AuthFixtures.createUser(app, {
      email: adminEmail,
      password: 'Test1234!',
      name: 'Settings Admin',
    })
    const prisma = app.get(PrismaService)
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
    await prisma.userRole.create({
      data: { userId: adminUser!.id, roleCode: 'admin', app: 'admin' },
    })
    adminToken = await AuthFixtures.loginAsAdmin(app, {
      email: adminEmail,
      password: 'Test1234!',
    })

    // 创建普通用户
    const user = await AuthFixtures.createUser(
      app,
      {
        email: userEmail,
        password: 'Test1234!',
        name: 'Settings User',
      },
      { remoteAddress: nextIp() },
    )
    userToken = await AuthFixtures.loginAs(
      app,
      { email: user.email, password: 'Test1234!' },
      { remoteAddress: nextIp() },
    )

    // 管理员播种 provider 池与 chat 模块配置
    const providerRes1 = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { ...adminAuthHeader(adminToken), 'x-app-context': 'admin' },
      payload: openaiProvider,
      remoteAddress: nextIp(),
    })
    expect(providerRes1.statusCode).toBe(200)

    const providerRes2 = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { ...adminAuthHeader(adminToken), 'x-app-context': 'admin' },
      payload: claudeProvider,
      remoteAddress: nextIp(),
    })
    expect(providerRes2.statusCode).toBe(200)

    const providerRes3 = await app.inject({
      method: 'POST',
      url: '/api/admin/providers',
      headers: { ...adminAuthHeader(adminToken), 'x-app-context': 'admin' },
      payload: disabledProvider,
      remoteAddress: nextIp(),
    })
    expect(providerRes3.statusCode).toBe(200)

    const chatConfigRes = await app.inject({
      method: 'POST',
      url: '/api/admin/system-config/chat',
      headers: { ...adminAuthHeader(adminToken), 'x-app-context': 'admin' },
      payload: {
        defaultProvider: 'openai',
        enabledProviders: ['openai', 'claude'],
        temperature: 0.7,
      },
      remoteAddress: nextIp(),
    })
    expect(chatConfigRes.statusCode).toBe(200)
  }, 120000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/settings', () => {
    it('AC-18: returns merged settings for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toBeDefined()
      expect(body.data.chat.defaultProvider).toBe('openai')
      expect(body.data.chat.enabledProviders).toEqual(['openai', 'claude'])
      expect(body.data.appearance.mode).toBeDefined()
    })

    it('AC-19: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /api/settings/:category', () => {
    it('returns chat settings for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/chat',
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.defaultProvider).toBe('openai')
      expect(body.data.enabledProviders).toEqual(['openai', 'claude'])
    })

    it('returns 400 for invalid category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/invalid-category',
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('INVALID_CONFIG_CATEGORY')
    })
  })

  describe('GET /api/settings/:category/providers', () => {
    it('returns enabled builtIn providers for chat', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/chat/providers',
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.builtIn).toHaveLength(2)
      expect(body.data.builtIn.map((p: { id: string }) => p.id)).toEqual(['openai', 'claude'])
      expect(body.data.builtIn[0].apiKey).toMatch(/^MASKED:/)
      expect(body.data.custom).toEqual([])
    })

    it('returns 400 for non-provider category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/indexing/providers',
        headers: authHeader(userToken),
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('INVALID_PROVIDER_CATEGORY')
    })
  })

  describe('POST /api/settings/:category', () => {
    it('AC-20: saves appearance settings for user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/appearance',
        headers: authHeader(userToken),
        payload: { mode: 'dark', fontSizeLevel: 4 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.appearance.mode).toBe('dark')
      expect(body.data.appearance.fontSizeLevel).toBe(4)
    })

    it('returns 400 when saving read-only category from user endpoint', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/chat',
        headers: authHeader(userToken),
        payload: { defaultProvider: 'claude', enabledProviders: ['claude'], temperature: 0.5 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('CATEGORY_READ_ONLY')
    })

    it('returns 400 for invalid appearance payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/appearance',
        headers: authHeader(userToken),
        payload: { mode: 'invalid', fontSizeLevel: 10 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/appearance',
        payload: { mode: 'light' },
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
