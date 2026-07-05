import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AuthFixtures, authHeader } from './helpers/auth.fixtures.js'
import { app, mockEmbeddingPort, mockLLMPort, prisma, setupE2E, teardownE2E } from './setup.ts'
import { cleanupTestData } from './teardown.ts'

const infraAvailable = process.env.DATABASE_URL?.includes('goferbot_test') ?? false

describe('RAG Server Integration E2E', () => {
  let token = ''
  let kbId = ''

  beforeAll(async () => {
    if (!infraAvailable) {
      console.log('[RAG E2E] 基础设施不可用，跳过 setup')
      return
    }
    await setupE2E()
    process.env.EMBEDDING_BASE_URL = `http://127.0.0.1:${mockEmbeddingPort}`
    process.env.EMBEDDING_API_KEY = 'mock'
  })

  afterAll(async () => {
    if (!infraAvailable) return
    await teardownE2E()
  })

  beforeEach(async () => {
    if (!infraAvailable) {
      console.log('[RAG E2E] 基础设施不可用，跳过 beforeEach')
      return
    }
    await cleanupTestData(prisma)
    try {
      await AuthFixtures.createUser(app, {
        email: 'q21-test@gofer.bot',
        password: 'Test1234!',
        name: 'Q21 Tester',
      })
    } catch {
      // user may already exist from prior run
    }
    token = await AuthFixtures.loginAsWeb(app, {
      email: 'q21-test@gofer.bot',
      password: 'Test1234!',
    })

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: authHeader(token),
      payload: {
        name: `Q21-TestKB-${crypto.randomUUID()}`,
        description: 'RAG integration test KB',
      },
    })
    kbId = kbRes.json().data?.id ?? ''
  })

  it('AC-01: upload triggers document job and sets status uploaded', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: authHeader(token),
      payload: Buffer.from(content),
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })

    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.data.status).toBe('uploaded')

    const doc = await prisma.document.findUnique({ where: { id: json.data.id } })
    expect(doc).toBeTruthy()
    expect(doc?.status).toBe('uploaded')
  })

  it('AC-02: worker processes job and status becomes ready with chunks', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: authHeader(token),
      payload: Buffer.from(content),
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })
    const docId = uploadRes.json().data.id

    await waitForDocumentStatus(docId, 'ready', 30000)

    const chunks = await prisma.chunk.findMany({ where: { documentId: docId } })
    expect(chunks.length).toBeGreaterThan(0)
    chunks.forEach((c) => {
      expect(c.content).toBeTruthy()
      expect(c.tokenCount).not.toBeNull()
    })
  })

  it('AC-03: chat with knowledgeBaseIds triggers RAG retrieval', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: authHeader(token),
      payload: Buffer.from(content),
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })
    await waitForDocumentStatus(uploadRes.json().data.id, 'ready', 30000)

    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: authHeader(token),
      payload: { title: 'Q21 Test Session' },
    })
    const sessionId = sessionRes.json().data.id

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: {
        message: 'What does the document say about GoferBot?',
        sessionId,
        knowledgeBaseIds: [kbId],
        config: {
          provider: 'openai',
          model: 'gpt-4',
          baseUrl: `http://127.0.0.1:${mockLLMPort}`,
          apiKey: 'mock',
        },
      },
    })

    expect(chatRes.statusCode).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')
  })

  it('AC-04: chat without knowledgeBaseIds behaves as baseline', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: authHeader(token),
      payload: { title: 'Q21 Baseline Session' },
    })
    const sessionId = sessionRes.json().data.id

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: {
        message: 'Hello',
        sessionId,
        config: {
          provider: 'openai',
          model: 'gpt-4',
          baseUrl: `http://127.0.0.1:${mockLLMPort}`,
          apiKey: 'mock',
        },
      },
    })

    expect(chatRes.statusCode).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')
  })
})

async function waitForDocumentStatus(
  docId: string,
  targetStatus: 'ready' | 'failed',
  timeoutMs = 30000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    if (doc?.status === targetStatus) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timeout waiting for document status ${targetStatus}`)
}
