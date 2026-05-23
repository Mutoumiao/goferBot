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

  it('AC-05: accepts knowledgeBaseIds in request without error', async () => {
    expect(true).toBe(false)
  })

  it('AC-06: E2E flow (create session → send message → verify stream → view history)', async () => {
    expect(true).toBe(false)
  })

  it('AC-07: returns 400 when message is empty', async () => {
    expect(true).toBe(false)
  })

  it('AC-08: returns 400 when message exceeds 4000 chars', async () => {
    expect(true).toBe(false)
  })

  it('AC-09: returns 400 when sessionId is not a valid UUID', async () => {
    expect(true).toBe(false)
  })

  it('AC-10: returns 400 when config fields are missing', async () => {
    expect(true).toBe(false)
  })

  it('AC-11: returns 400 when config.baseUrl is not in whitelist', async () => {
    expect(true).toBe(false)
  })

  it('AC-12: returns 401 without valid JWT', async () => {
    expect(true).toBe(false)
  })

  it('AC-13: returns error via SSE when user is not session owner', async () => {
    expect(true).toBe(false)
  })

  it('AC-14: returns error via SSE when session does not exist', async () => {
    expect(true).toBe(false)
  })

  it('AC-15: returns error via SSE when LLM API fails', async () => {
    expect(true).toBe(false)
  })

  it('AC-16: returns LLM_TIMEOUT error when LLM times out', async () => {
    expect(true).toBe(false)
  })

  it('AC-17: persists assistant message even when LLM returns empty', async () => {
    expect(true).toBe(false)
  })
})
