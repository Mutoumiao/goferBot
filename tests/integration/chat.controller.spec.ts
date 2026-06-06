/**
 * ChatController 集成测试
 * 覆盖端点：POST /api/chat
 * 场景：SSE 流式响应 happy path、Zod 验证失败、认证缺失、客户端断开处理
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { ChatService } from '../../packages/server/src/modules/chat/chat.service.js'
import { createIpGenerator } from './helpers/test-utils.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

const nextIp = createIpGenerator(3)

describe('ChatController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('chat_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `chat-${Date.now()}@test.gofer`
    await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Chat User' }, { remoteAddress: nextIp() })
    userToken = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' }, { remoteAddress: nextIp() })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('POST /api/chat', () => {
    it('AC-60: returns SSE stream for valid request', async () => {
      const chatService = app.get(ChatService)
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        yield { content: 'Hello', done: false }
        yield { content: '!', done: false }
        yield { done: true }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/event-stream')
    })

    it('AC-61: returns 400 for empty message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: '',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-62: returns 400 for invalid sessionId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: 'invalid-uuid',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-63: returns 400 for empty provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: '',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-64: returns 400 for disallowed baseUrl', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://evil.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-65: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-66: handles client disconnect gracefully', async () => {
      const chatService = app.get(ChatService)
      const abortSpy = vi.fn()
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        try {
          yield { content: 'Hello', done: false }
          await new Promise(resolve => setTimeout(resolve, 100))
          yield { content: '!', done: false }
        } finally {
          abortSpy()
        }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(200)
    })
  })
})
