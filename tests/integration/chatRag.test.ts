// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-chat-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/chat.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  // db.close() // 全局 db 连接不应在单个测试文件中关闭
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  db.exec('DELETE FROM messages')
  db.exec('DELETE FROM sessions')
  vi.restoreAllMocks()
})

describe('POST /chat with knowledgeBaseIds', () => {
  it('saves message with knowledge_base_ids JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode('data: {"content":"hi"}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    } as Response)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello rag',
        sessionId: 'rag-session-1',
        knowledgeBaseIds: ['kb1'],
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost', apiKey: 'test' },
      }),
    })

    expect(res.status).toBe(200)

    const msg = db
      .prepare('SELECT knowledge_base_ids FROM messages WHERE session_id = ? AND role = ?')
      .get('rag-session-1', 'user') as { knowledge_base_ids: string } | undefined

    expect(msg).toBeDefined()
    expect(msg?.knowledge_base_ids).toBe('["kb1"]')
  })

  it('saves null knowledge_base_ids when not provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode('data: {"content":"hi"}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    } as Response)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello no rag',
        sessionId: 'rag-session-2',
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost', apiKey: 'test' },
      }),
    })

    expect(res.status).toBe(200)

    const msg = db
      .prepare('SELECT knowledge_base_ids FROM messages WHERE session_id = ? AND role = ?')
      .get('rag-session-2', 'user') as { knowledge_base_ids: string | null } | undefined

    expect(msg).toBeDefined()
    expect(msg?.knowledge_base_ids).toBeNull()
  })

  it('continues chat when RAG retrieval fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello rag fail',
        sessionId: 'rag-session-3',
        knowledgeBaseIds: ['kb1'],
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost', apiKey: 'test' },
      }),
    })

    expect(res.status).toBe(200)
  })

  it('saves multiple knowledgeBaseIds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode('data: {"content":"hi"}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    } as Response)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello multi kb',
        sessionId: 'rag-session-4',
        knowledgeBaseIds: ['kb1', 'kb2'],
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost', apiKey: 'test' },
      }),
    })

    expect(res.status).toBe(200)

    const msg = db
      .prepare('SELECT knowledge_base_ids FROM messages WHERE session_id = ? AND role = ?')
      .get('rag-session-4', 'user') as { knowledge_base_ids: string } | undefined

    expect(msg).toBeDefined()
    expect(msg?.knowledge_base_ids).toBe('["kb1","kb2"]')
  })
})
