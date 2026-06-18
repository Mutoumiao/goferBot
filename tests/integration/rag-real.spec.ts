import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import nock from 'nock'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { checkInfrastructure } from './helpers/infra-check.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

describe('RAG Real Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  let kbId: string
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[RAG Real] 基础设施不可用，跳过真实集成测试')
      console.log('[RAG Real] 详情:', infraResult.details)
      return
    }

    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('rag_real')
    dbName = new URL(dbUrl).pathname.slice(1)

    // 设置 Embedding API mock 环境变量
    process.env.EMBEDDING_BASE_URL = 'http://localhost:9999'
    process.env.EMBEDDING_API_KEY = 'test-key'

    app = await TestAppFactory.create(dbUrl, { realMode: true })

    // Mock Embedding API（持久化，所有测试复用）
    nock('http://localhost:9999')
      .post('/v1/embeddings')
      .reply(200, () => ({
        data: [{ embedding: new Array(1536).fill(0.1).map((v, i) => v + i * 0.0001) }],
      }))
      .persist()
  }, 120000)

  afterAll(async () => {
    nock.cleanAll()
    if (app) {
      await app.close()
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })

  beforeEach(async () => {
    if (!infraAvailable) return

    // 清理数据
    const prisma = app.get('PrismaService')
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE chunks, documents, knowledge_bases, users RESTART IDENTITY CASCADE
    `)

    // 创建测试用户
    const timestamp = Date.now()
    const email = `rag-real-${timestamp}@test.gofer`
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'Test1234!', name: 'RAG Real Tester' },
    })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'Test1234!' },
    })
    token = loginRes.json().data.accessToken

    // 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `RAG-Real-KB-${timestamp}`, description: 'Real integration test KB' },
    })
    kbId = kbRes.json().data.id
  })

  // AC-03: 索引链路
  it('AC-03: 文本文件上传后经过解析→分块→嵌入，PG Chunk 表和 pgvector 均有数据，document status = ready', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const content = 'GoferBot RAG 真实集成测试内容。'.repeat(50)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const multipartBody = buildMultipartBody(
      boundary,
      'file',
      'rag-test.txt',
      'text/plain',
      Buffer.from(content),
    )

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/upload`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${token}`,
      },
      payload: multipartBody,
    })

    expect(uploadRes.statusCode).toBe(201)
    const docId = uploadRes.json().data.id

    // 等待 Worker 处理完成（最长 60 秒）
    await waitForDocumentStatus(docId, 'ready', 60000)

    // 验证 PG Chunk 表
    const prisma = app.get('PrismaService')
    const chunks = await prisma.chunk.findMany({ where: { documentId: docId } })
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].content).toBeTruthy()
    expect(chunks[0].tokenCount).toBeGreaterThan(0)

    // 验证 pgvector 向量存在（通过原始 SQL 查询）
    const chunkWithEmbedding = await prisma.$queryRaw`
      SELECT embedding IS NOT NULL as has_embedding
      FROM chunks
      WHERE document_id = ${docId}
      LIMIT 1
    `
    expect(chunkWithEmbedding[0]?.has_embedding).toBe(true)
  }, 90000)

  // AC-04: 检索链路
  it('AC-04: 向量化查询后 Chat API 返回 SSE 响应，验证检索链路可用', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    // 先上传并索引文档
    const content =
      'GoferBot 是一个基于 Vue 3 和 NestJS 的 AI Workspace 项目。它支持文档管理、LLM 问答和 RAG 检索增强。'
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const multipartBody = buildMultipartBody(
      boundary,
      'file',
      'rag-retrieval.txt',
      'text/plain',
      Buffer.from(content),
    )

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/upload`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${token}`,
      },
      payload: multipartBody,
    })

    expect(uploadRes.statusCode).toBe(201)
    const docId = uploadRes.json().data.id
    await waitForDocumentStatus(docId, 'ready', 60000)

    // 通过 Chat API 验证检索链路
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'RAG Retrieval Test' },
    })
    const sessionId = sessionRes.json().data.id

    // Mock LLM API
    nock('http://localhost:9998')
      .post('/v1/chat/completions')
      .reply(
        200,
        () => {
          const sse = [
            'data: {"choices":[{"delta":{"role":"assistant"}}]}',
            'data: {"choices":[{"delta":{"content":"GoferBot 是一个 AI Workspace 项目。"}}]}',
            'data: [DONE]',
          ].join('\n\n')
          return sse
        },
        { 'Content-Type': 'text/event-stream' },
      )

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        message: '什么是 GoferBot？',
        sessionId,
        knowledgeBaseIds: [kbId],
        config: {
          provider: 'openai',
          model: 'gpt-4',
          baseUrl: 'http://localhost:9998',
          apiKey: 'mock',
        },
      },
    })

    expect(chatRes.statusCode).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')

    // 验证 SSE 内容包含 AI 响应
    const chatBody = chatRes.body as string
    expect(chatBody).toContain('GoferBot')
  }, 90000)

  // AC-05: 失败降级
  it('AC-05: 索引失败时 document status 变为 failed，系统不崩溃', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    // 临时移除 Embedding mock，让请求失败
    nock.cleanAll()

    const content = '测试失败降级。'
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const multipartBody = buildMultipartBody(
      boundary,
      'file',
      'rag-fail.txt',
      'text/plain',
      Buffer.from(content),
    )

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/upload`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${token}`,
      },
      payload: multipartBody,
    })

    expect(uploadRes.statusCode).toBe(201)
    const docId = uploadRes.json().data.id

    // 等待 Worker 处理失败（最长 30 秒）
    await waitForDocumentStatus(docId, 'failed', 30000)

    // 验证状态为 failed
    const prisma = app.get('PrismaService')
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    expect(doc?.status).toBe('failed')
    expect(doc?.errorMessage).toBeTruthy()

    // 恢复 Embedding mock
    nock('http://localhost:9999')
      .post('/v1/embeddings')
      .reply(200, () => ({
        data: [{ embedding: new Array(1536).fill(0.1).map((v, i) => v + i * 0.0001) }],
      }))
      .persist()
  }, 60000)
})

function buildMultipartBody(
  boundary: string,
  fieldName: string,
  filename: string,
  contentType: string,
  buffer: Buffer,
): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([prefix, buffer, suffix])
}

async function waitForDocumentStatus(
  docId: string,
  targetStatus: 'ready' | 'failed',
  timeoutMs: number,
): Promise<void> {
  const start = Date.now()
  // 使用延迟导入避免在模块加载时初始化 Prisma
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    while (Date.now() - start < timeoutMs) {
      const doc = await prisma.document.findUnique({ where: { id: docId } })
      if (doc?.status === targetStatus) return
      if (doc?.status === 'failed' && targetStatus !== 'failed') {
        throw new Error(`Document indexing failed: ${doc.errorMessage}`)
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error(`Timeout waiting for document status ${targetStatus}`)
  } finally {
    await prisma.$disconnect()
  }
}
