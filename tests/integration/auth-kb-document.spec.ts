import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { publicEncrypt, constants } from 'node:crypto'
import nock from 'nock'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { checkInfrastructure } from './helpers/infra-check.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

/**
 * 真实模式集成测试：文档上传 + Worker 异步处理
 * 需要完整基础设施：PostgreSQL + pgvector + Redis + MinIO
 * 当基础设施不可用时自动跳过
 */
describe('Document Upload Real Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[auth-kb-document] 基础设施不可用，跳过')
      console.log('[auth-kb-document] 详情:', infraResult.details)
      return
    }

    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('q17_rev')
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
    try {
      nock.cleanAll()
      if (app) {
        await app.close()
      }
    } finally {
      if (dbManager && dbName) {
        await dbManager.dropDatabase(dbName)
      }
    }
  })

  beforeEach(async () => {
    if (!infraAvailable) return
    const prisma = app.get('PrismaService')
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE chunks, documents, knowledge_bases, users RESTART IDENTITY CASCADE
    `)
  })

  // AC-12: 上传文档到知识库，状态变为 ready
  it('AC-12: 上传文档到知识库，状态变为 ready', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const timestamp = Date.now()
    const email = `q17-ac12-${timestamp}@test.gofer`

    // 注册并登录
    const token = await registerAndLogin(app, email, 'Test1234!')

    // 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `AC12-KB-${timestamp}`, description: 'AC-12 test KB' },
    })
    const kbId = kbRes.json().data.id

    // 上传文档
    const content = 'GoferBot AC-12 测试内容。'.repeat(50)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const multipartBody = buildMultipartBody(boundary, 'file', 'ac12-test.txt', 'text/plain', Buffer.from(content))

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
    await waitForDocumentStatus(app, docId, 'ready', 60000)

    // 验证状态为 ready
    const prisma = app.get('PrismaService')
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    expect(doc?.status).toBe('ready')
  }, 90000)

  // AC-16: 上传 txt/md/pdf 三种类型文档
  it('AC-16: 上传 txt/md/pdf 三种类型文档', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const timestamp = Date.now()
    const email = `q17-ac16-${timestamp}@test.gofer`

    // 注册并登录
    const token = await registerAndLogin(app, email, 'Test1234!')

    // 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `AC16-KB-${timestamp}`, description: 'AC-16 test KB' },
    })
    const kbId = kbRes.json().data.id

    // 测试 txt 和 md（PDF 解析未实现，单独测试）
    const textFiles = [
      { name: 'test.txt', mimeType: 'text/plain', content: 'GoferBot txt 测试内容。'.repeat(30) },
      { name: 'test.md', mimeType: 'text/markdown', content: '# GoferBot\n\nMarkdown 测试内容。'.repeat(20) },
    ]

    for (const file of textFiles) {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', file.name, file.mimeType, Buffer.from(file.content))

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

      // 等待处理完成
      await waitForDocumentStatus(app, docId, 'ready', 60000)

      // 验证状态
      const prisma = app.get('PrismaService')
      const doc = await prisma.document.findUnique({ where: { id: docId } })
      expect(doc?.status).toBe('ready')
      expect(doc?.mimeType).toBe(file.mimeType)
    }

    // PDF 上传测试：解析未实现，预期状态为 failed
    const pdfBoundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const pdfBody = buildMultipartBody(pdfBoundary, 'file', 'test.pdf', 'application/pdf', Buffer.from('%PDF-1.4\nGoferBot PDF 测试内容。'))

    const pdfUploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents/upload`,
      headers: {
        'content-type': `multipart/form-data; boundary=${pdfBoundary}`,
        authorization: `Bearer ${token}`,
      },
      payload: pdfBody,
    })

    expect(pdfUploadRes.statusCode).toBe(201)
    const pdfDocId = pdfUploadRes.json().data.id

    // 等待处理失败
    await waitForDocumentStatus(app, pdfDocId, 'failed', 60000)

    const prisma = app.get('PrismaService')
    const pdfDoc = await prisma.document.findUnique({ where: { id: pdfDocId } })
    expect(pdfDoc?.status).toBe('failed')
    expect(pdfDoc?.mimeType).toBe('application/pdf')
    expect(pdfDoc?.errorMessage).toBeTruthy()
  }, 180000)
})

// ---- 辅助函数 ----

async function encryptPassword(app: NestFastifyApplication, password: string): Promise<string> {
  const keyRes = await app.inject({
    method: 'GET',
    url: '/api/auth/public-key',
  })
  const body = keyRes.json()
  const publicKey = body.data ? body.data.publicKey : body.publicKey

  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  return encrypted.toString('base64')
}

async function registerAndLogin(
  app: NestFastifyApplication,
  email: string,
  password: string,
): Promise<string> {
  const encryptedPassword = await encryptPassword(app, password)

  // 注册
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, encryptedPassword, name: 'Test User' },
  })
  if (registerRes.statusCode >= 400) {
    throw new Error(`register failed: ${registerRes.statusCode} ${registerRes.body}`)
  }

  // 登录
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, encryptedPassword },
  })
  if (loginRes.statusCode >= 400) {
    throw new Error(`login failed: ${loginRes.statusCode} ${loginRes.body}`)
  }

  return loginRes.json().data.accessToken
}

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
  app: NestFastifyApplication,
  docId: string,
  targetStatus: 'ready' | 'failed',
  timeoutMs: number,
): Promise<void> {
  const start = Date.now()
  const prisma = app.get('PrismaService')

  while (Date.now() - start < timeoutMs) {
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    if (doc?.status === targetStatus) return
    if (doc?.status === 'failed' && targetStatus !== 'failed') {
      throw new Error(`Document indexing failed: ${doc.errorMessage}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timeout waiting for document status ${targetStatus}`)
}
