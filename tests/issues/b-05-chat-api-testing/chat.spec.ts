import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'

// ============================================================
// 辅助函数
// ============================================================

function parseSSE(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(6)))
}

function makeOpenAIChunk(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

/** 用 vi.fn() mock global.fetch，返回 ReadableStream 模拟 OpenAI SSE 流 */
function mockFetchSSE(chunks: string[], opts?: { status?: number; delayMs?: number }) {
  const encoder = new TextEncoder()
  const status = opts?.status ?? 200
  const body = chunks.map(makeOpenAIChunk).join('') + 'data: [DONE]\n\n'

  vi.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const signal = init?.signal as AbortSignal | undefined

    // 延迟响应 —— 支持 AbortController 超时测试
    if (opts?.delayMs) {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted', 'AbortError'))
          return
        }
        const timer = setTimeout(resolve, opts.delayMs)
        const onAbort = () => {
          clearTimeout(timer)
          reject(new DOMException('The operation was aborted', 'AbortError'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body))
          controller.close()
        },
      }),
      { status },
    ) as unknown as Response
  })
}

const defaultConfig = {
  provider: 'openai',
  model: 'gpt-4',
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test',
}

function chatPayload(overrides: Record<string, unknown> = {}) {
  return {
    message: 'Hello, AI!',
    sessionId: '00000000-0000-0000-0000-000000000000',
    config: defaultConfig,
    ...overrides,
  }
}

async function createTestSession(app: NestFastifyApplication, token: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Test Chat' },
  })
  return res.json().data
}

describe('ChatController', () => {
  const dbManager = new TestDatabaseManager()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // AC-01: SSE 流式输出
  // ============================================================

  it('AC-01: POST /api/chat returns SSE stream with chunks', async () => {
    const dbUrl = await dbManager.createDatabase('chat_sse')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c1@gofer.bot', password: 'Test1234!', name: 'C1' })
    const token = await AuthFixtures.loginAs(app, { email: 'c1@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['Hello', ' World'])

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/event-stream')

    const chunks = parseSSE(res.payload)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toEqual({ chunk: 'Hello', done: false })
    expect(chunks[1]).toEqual({ chunk: ' World', done: false })
    expect(chunks[2]).toEqual({ chunk: '', done: true })

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-02: SSE 格式验证
  // ============================================================

  it('AC-02: SSE stream has valid format (data:, done marker)', async () => {
    const dbUrl = await dbManager.createDatabase('chat_format')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c2@gofer.bot', password: 'Test1234!', name: 'C2' })
    const token = await AuthFixtures.loginAs(app, { email: 'c2@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['Test'])

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.headers['content-type']).toBe('text/event-stream')
    expect(res.headers['cache-control']).toBe('no-cache')
    expect(res.headers['connection']).toBe('keep-alive')

    const lines = res.payload.split('\n\n').filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(2)

    for (const line of lines) {
      expect(line).toMatch(/^data: /)
      const json = JSON.parse(line.slice(6))
      expect(json).toHaveProperty('done')
      if (json.done) {
        expect(json.chunk).toBe('')
      } else {
        expect(typeof json.chunk).toBe('string')
        expect(json.chunk.length).toBeGreaterThan(0)
      }
    }

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-03: Abort 清理验证
  // ============================================================

  it('AC-03: handles abort gracefully and cleans up resources', async () => {
    const prevTimeout = process.env.LLM_TIMEOUT_MS
    process.env.LLM_TIMEOUT_MS = '300'

    const dbUrl = await dbManager.createDatabase('chat_abort')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c3@gofer.bot', password: 'Test1234!', name: 'C3' })
    const token = await AuthFixtures.loginAs(app, { email: 'c3@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['partial'], { delayMs: 2000 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
    expect(lastChunk.done).toBe(true)
    expect(lastChunk.error).toBeDefined()

    await expect(app.close()).resolves.not.toThrow()

    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)

    if (prevTimeout) process.env.LLM_TIMEOUT_MS = prevTimeout
    else delete process.env.LLM_TIMEOUT_MS
  })

  // ============================================================
  // AC-04: 消息持久化
  // ============================================================

  it('AC-04: persists user and assistant messages to database', async () => {
    const dbUrl = await dbManager.createDatabase('chat_persist')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c4@gofer.bot', password: 'Test1234!', name: 'C4' })
    const token = await AuthFixtures.loginAs(app, { email: 'c4@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['Hello', ' World'])

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    const prisma = app.get(PrismaService)
    const messages = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Hello, AI!')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('Hello World')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // 占位测试（任务 3~6 实现）
  // ============================================================

  // ============================================================
  // AC-05: knowledgeBaseIds 参数接受
  // ============================================================

  it('AC-05: accepts knowledgeBaseIds in request without error', async () => {
    const dbUrl = await dbManager.createDatabase('chat_kbids')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c5@gofer.bot', password: 'Test1234!', name: 'C5' })
    const token = await AuthFixtures.loginAs(app, { email: 'c5@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['OK'])

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({
        sessionId: session.id,
        knowledgeBaseIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    expect(chunks.some((c: any) => c.chunk === 'OK')).toBe(true)
    expect(chunks[chunks.length - 1].done).toBe(true)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-06: E2E 完整链路
  // ============================================================

  it('AC-06: E2E flow (create session → send message → verify stream → view history)', async () => {
    const dbUrl = await dbManager.createDatabase('chat_e2e')
    const app = await TestAppFactory.create(dbUrl)

    // Step 1: 注册 + 登录
    const user = await AuthFixtures.createUser(app, { email: 'c6@gofer.bot', password: 'Test1234!', name: 'C6' })
    const token = await AuthFixtures.loginAs(app, { email: 'c6@gofer.bot', password: 'Test1234!' })

    // Step 2: 创建会话
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'E2E Test Chat' },
    })
    expect(sessionRes.statusCode).toBe(201)
    const session = sessionRes.json().data
    expect(session.title).toBe('E2E Test Chat')

    // Step 3: 发送消息，获取 SSE 流
    mockFetchSSE(['E2E', ' Response'])

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id, message: 'E2E test message' }),
    })
    expect(chatRes.statusCode).toBe(200)

    const chunks = parseSSE(chatRes.payload)
    expect(chunks[0]).toEqual({ chunk: 'E2E', done: false })
    expect(chunks[1]).toEqual({ chunk: ' Response', done: false })
    expect(chunks[2]).toEqual({ chunk: '', done: true })

    // Step 4: 查看会话历史
    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(historyRes.statusCode).toBe(200)
    const history = historyRes.json().data
    expect(history.messages).toHaveLength(2)
    expect(history.messages[0].role).toBe('user')
    expect(history.messages[0].content).toBe('E2E test message')
    expect(history.messages[1].role).toBe('assistant')
    expect(history.messages[1].content).toBe('E2E Response')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-07: message 为空 → 400
  // ============================================================

  it('AC-07: returns 400 when message is empty', async () => {
    const dbUrl = await dbManager.createDatabase('chat_msg_empty')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c7@gofer.bot', password: 'Test1234!', name: 'C7' })
    const token = await AuthFixtures.loginAs(app, { email: 'c7@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ message: '' }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-08: message 超长 → 400
  // ============================================================

  it('AC-08: returns 400 when message exceeds 4000 chars', async () => {
    const dbUrl = await dbManager.createDatabase('chat_msg_long')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c8@gofer.bot', password: 'Test1234!', name: 'C8' })
    const token = await AuthFixtures.loginAs(app, { email: 'c8@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ message: 'a'.repeat(4001) }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-09: sessionId 非 UUID → 400
  // ============================================================

  it('AC-09: returns 400 when sessionId is not a valid UUID', async () => {
    const dbUrl = await dbManager.createDatabase('chat_sid_fmt')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c9@gofer.bot', password: 'Test1234!', name: 'C9' })
    const token = await AuthFixtures.loginAs(app, { email: 'c9@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: 'not-a-uuid' }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-10: config 字段缺失 → 400
  // ============================================================

  it('AC-10: returns 400 when config fields are missing', async () => {
    const dbUrl = await dbManager.createDatabase('chat_cfg_miss')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c10@gofer.bot', password: 'Test1234!', name: 'C10' })
    const token = await AuthFixtures.loginAs(app, { email: 'c10@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'test', sessionId: '00000000-0000-0000-0000-000000000000', config: {} },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-11: baseUrl 不在白名单 → 400
  // ============================================================

  it('AC-11: returns 400 when config.baseUrl is not in whitelist', async () => {
    const dbUrl = await dbManager.createDatabase('chat_ssrf')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c11@gofer.bot', password: 'Test1234!', name: 'C11' })
    const token = await AuthFixtures.loginAs(app, { email: 'c11@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({
        config: { ...defaultConfig, baseUrl: 'https://evil.example.com' },
      }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-12: 无 JWT → 401
  // ============================================================

  it('AC-12: returns 401 without valid JWT', async () => {
    const dbUrl = await dbManager.createDatabase('chat_401')
    const app = await TestAppFactory.create(dbUrl)

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: chatPayload({ sessionId: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('AUTH_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-13: 非会话所有者 → SSE error
  // ============================================================

  it('AC-13: returns error via SSE when user is not session owner', async () => {
    const dbUrl = await dbManager.createDatabase('chat_perm')
    const app = await TestAppFactory.create(dbUrl)

    const userA = await AuthFixtures.createUser(app, { email: 'owner@gofer.bot', password: 'Test1234!', name: 'Owner' })
    const tokenA = await AuthFixtures.loginAs(app, { email: 'owner@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, tokenA)

    const userB = await AuthFixtures.createUser(app, { email: 'intruder@gofer.bot', password: 'Test1234!', name: 'Intruder' })
    const tokenB = await AuthFixtures.loginAs(app, { email: 'intruder@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
    expect(lastChunk.done).toBe(true)
    expect(lastChunk.error).toBe('无权访问该会话')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-14: 会话不存在 → SSE error
  // ============================================================

  it('AC-14: returns error via SSE when session does not exist', async () => {
    const dbUrl = await dbManager.createDatabase('chat_notfound')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c14@gofer.bot', password: 'Test1234!', name: 'C14' })
    const token = await AuthFixtures.loginAs(app, { email: 'c14@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: '00000000-0000-0000-0000-000000000000' }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
    expect(lastChunk.done).toBe(true)
    expect(lastChunk.error).toBe('会话不存在')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-15: LLM API 失败 → SSE error
  // ============================================================

  it('AC-15: returns error via SSE when LLM API fails', async () => {
    const dbUrl = await dbManager.createDatabase('chat_llmerr')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c15@gofer.bot', password: 'Test1234!', name: 'C15' })
    const token = await AuthFixtures.loginAs(app, { email: 'c15@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE([], { status: 500 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
    expect(lastChunk.done).toBe(true)
    expect(lastChunk.error).toContain('LLM 请求失败')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  // ============================================================
  // AC-16: LLM 超时 → SSE LLM_TIMEOUT error
  // ============================================================

  it('AC-16: returns LLM_TIMEOUT error when LLM times out', async () => {
    const prevTimeout = process.env.LLM_TIMEOUT_MS
    process.env.LLM_TIMEOUT_MS = '500'

    const dbUrl = await dbManager.createDatabase('chat_timeout')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c16@gofer.bot', password: 'Test1234!', name: 'C16' })
    const token = await AuthFixtures.loginAs(app, { email: 'c16@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE(['irrelevant'], { delayMs: 2000 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    expect(res.statusCode).toBe(200)
    const chunks = parseSSE(res.payload)
    const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
    expect(lastChunk.done).toBe(true)
    expect(lastChunk.error).toContain('LLM 请求超时')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)

    if (prevTimeout) process.env.LLM_TIMEOUT_MS = prevTimeout
    else delete process.env.LLM_TIMEOUT_MS
  })

  // ============================================================
  // AC-17: LLM 空回复持久化
  // ============================================================

  it('AC-17: persists assistant message even when LLM returns empty', async () => {
    const dbUrl = await dbManager.createDatabase('chat_empty')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'c17@gofer.bot', password: 'Test1234!', name: 'C17' })
    const token = await AuthFixtures.loginAs(app, { email: 'c17@gofer.bot', password: 'Test1234!' })
    const session = await createTestSession(app, token)

    mockFetchSSE([])

    await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: chatPayload({ sessionId: session.id }),
    })

    const prisma = app.get(PrismaService)
    const messages = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
