/**
 * ChatController 集成测试
 * 覆盖端点：POST /api/chat-messages
 * 场景：SSE 流式响应 happy path、Zod 校验失败、认证缺失、会话不存在/无权访问
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ChatService } from '../../packages/server/src/modules/chat/chat.service.js'
import { AuthFixtures, authHeader } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(4)

describe('ChatController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string
  let _userId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('chat_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `chat-${Date.now()}@test.gofer`
    const user = await AuthFixtures.createUser(
      app,
      { email, password: 'Test1234!', name: 'Chat User' },
      { remoteAddress: nextIp() },
    )
    _userId = user.id
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

  async function createSession(title = 'Test Session') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: authHeader(userToken),
      payload: { title },
    })
    expect(res.statusCode).toBe(201)
    return res.json().data.id as string
  }

  describe('POST /api/chat-messages', () => {
    it('AC-60: returns SSE stream for valid request', async () => {
      const sessionId = await createSession()
      const chatService = app.get(ChatService)
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        yield {
          event: 'message',
          conversation_id: sessionId,
          message_id: '00000000-0000-0000-0000-000000000001',
          answer: 'Hello',
          done: false,
        }
        yield {
          event: 'message',
          conversation_id: sessionId,
          message_id: '00000000-0000-0000-0000-000000000001',
          answer: '',
          done: true,
        }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(userToken),
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: sessionId,
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/event-stream')
      expect(res.payload).toContain('"answer":"Hello"')
      expect(res.payload).toContain('"done":true')
    })

    it('AC-61: returns 400 for empty query', async () => {
      const sessionId = await createSession()
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(userToken),
        payload: {
          response_mode: 'streaming',
          query: '',
          conversation_id: sessionId,
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-62: returns 400 for invalid conversation_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(userToken),
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: 'invalid-uuid',
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-63: returns 404 when session does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(userToken),
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-64: returns 403 for other user session', async () => {
      const otherEmail = `chat-other-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email: otherEmail, password: 'Test1234!', name: 'Other User' },
        { remoteAddress: nextIp() },
      )
      const otherToken = await AuthFixtures.loginAs(
        app,
        { email: otherEmail, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )

      const sessionId = await createSession('Private Session')
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(otherToken),
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: sessionId,
        },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('AC-65: returns 401 without token', async () => {
      const sessionId = await createSession()
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: sessionId,
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-66: handles stream error as SSE error event', async () => {
      const sessionId = await createSession()
      const chatService = app.get(ChatService)
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        yield {
          event: 'message',
          conversation_id: sessionId,
          message_id: '00000000-0000-0000-0000-000000000001',
          answer: 'Hello',
          done: false,
        }
        throw new Error('LLM stream failed')
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat-messages',
        headers: authHeader(userToken),
        payload: {
          response_mode: 'streaming',
          query: 'Hello',
          conversation_id: sessionId,
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.payload).toContain('"error":"LLM stream failed"')
    })
  })
})
