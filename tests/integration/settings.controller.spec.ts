/**
 * SettingsController 集成测试
 * 覆盖端点：GET /api/settings, POST /api/settings
 * 场景：happy path、Zod 验证失败、认证缺失/无效、边界条件
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { createIpGenerator } from './helpers/test-utils.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

const nextIp = createIpGenerator(11)

describe('SettingsController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('settings_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `settings-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Settings Test',
    }, { remoteAddress: nextIp() })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' }, { remoteAddress: nextIp() })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  const validSettings = {
    providers: {
      openai: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: '' },
      claude: { apiKey: 'sk-test', model: 'claude-3', baseUrl: '' },
      deepseek: { apiKey: 'sk-test', model: 'deepseek-chat', baseUrl: '' },
      custom: { apiKey: 'sk-test', model: 'custom', baseUrl: '' },
      ollama: { enabled: false, url: 'http://localhost:11434', model: 'llama2', baseUrl: '' },
    },
    embeddingProvider: { provider: 'openai', apiKey: 'sk-test', model: 'text-embedding-3', baseUrl: '' },
    temperature: 0.7,
    defaultChatProvider: 'openai',
  }

  describe('GET /api/settings', () => {
    it('AC-18: returns settings for authenticated user', async () => {
      // 先保存设置
      await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: validSettings,
        remoteAddress: nextIp(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toBeDefined()
      // 验证保存的值被正确返回
      expect(body.data.defaultChatProvider).toBe('openai')
    })

    it('AC-19: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/settings', () => {
    it('AC-20: saves settings with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: validSettings,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.defaultChatProvider).toBe('openai')
      expect(body.data.temperature).toBe(0.7)
    })

    it('AC-21: returns 400 for missing providers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, providers: undefined },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-22: returns 400 for invalid temperature (out of range)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, temperature: 3 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-23: returns 400 for invalid defaultChatProvider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, defaultChatProvider: 'invalid-provider' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-24: returns 400 for invalid baseUrl (SSRF)', async () => {
      const badSettings = {
        ...validSettings,
        providers: {
          ...validSettings.providers,
          openai: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: 'http://192.168.1.1' },
        },
      }
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: badSettings,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-25: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        payload: validSettings,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
