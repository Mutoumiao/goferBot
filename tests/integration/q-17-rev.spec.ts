import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import nock from 'nock'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { checkInfrastructure } from './helpers/infra-check.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('q-17 Real API Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[q-17-rev] 基础设施不可用，跳过')
      console.log('[q-17-rev] 详情:', infraResult.details)
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
    const prisma = app.get('PrismaService')
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE chunks, documents, knowledge_bases, users RESTART IDENTITY CASCADE
    `)
  })

  // AC-06: 未登录访问保护路由返回 401
  it('AC-06: 未登录访问保护路由返回 401', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    // 测试 /api/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    })
    expect(meRes.statusCode).toBe(401)

    // 测试 /api/knowledge-bases
    const kbRes = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
    })
    expect(kbRes.statusCode).toBe(401)
  })

  // AC-08: 重复注册相同邮箱返回 409
  it('AC-08: 重复注册相同邮箱返回 409', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const email = `q17-rev-${Date.now()}@test.gofer`

    // 第一次注册
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'Test1234!', name: 'First User' },
    })
    expect(firstRes.statusCode).toBe(201)

    // 第二次使用相同邮箱注册
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'Test1234!', name: 'Second User' },
    })
    expect(secondRes.statusCode).toBe(409)
    const body = secondRes.json()
    expect(body.error || body.message).toBeTruthy()
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
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'Test1234!', name: 'AC-12 Tester' },
    })
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'Test1234!' },
    })
    const token = loginRes.json().data.accessToken

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

  // AC-15: 用户 B 无法操作用户 A 的知识库
  it('AC-15: 用户 B 无法操作用户 A 的知识库', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const timestamp = Date.now()

    // 创建用户 A
    const emailA = `q17-usera-${timestamp}@test.gofer`
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: emailA, password: 'Test1234!', name: 'User A' },
    })
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailA, password: 'Test1234!' },
    })
    const tokenA = loginA.json().data.accessToken

    // 用户 A 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: `AC15-KB-A-${timestamp}`, description: 'User A KB' },
    })
    const kbId = kbRes.json().data.id

    // 创建用户 B
    const emailB = `q17-userb-${timestamp}@test.gofer`
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: emailB, password: 'Test1234!', name: 'User B' },
    })
    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailB, password: 'Test1234!' },
    })
    const tokenB = loginB.json().data.accessToken

    // 用户 B 尝试操作用户 A 的知识库 — 列表
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${tokenB}` },
    })
    const kbList = listRes.json().data
    const userBCanSeeUserAKB = kbList.some((kb: any) => kb.id === kbId)
    expect(userBCanSeeUserAKB).toBe(false)

    // 用户 B 尝试操作用户 A 的知识库 — 获取详情（404 或 403）
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(getRes.statusCode).toBeOneOf([403, 404])

    // 用户 B 尝试操作用户 A 的知识库 — 更新（403）
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kbId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { name: 'Hacked Name' },
    })
    expect(patchRes.statusCode).toBe(403)

    // 用户 B 尝试操作用户 A 的知识库 — 删除（403）
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kbId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(deleteRes.statusCode).toBe(403)
  })

  // AC-16: 上传 txt/md/pdf 三种类型文档
  it('AC-16: 上传 txt/md/pdf 三种类型文档', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const timestamp = Date.now()
    const email = `q17-ac16-${timestamp}@test.gofer`

    // 注册并登录
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'Test1234!', name: 'AC-16 Tester' },
    })
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'Test1234!' },
    })
    const token = loginRes.json().data.accessToken

    // 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `AC16-KB-${timestamp}`, description: 'AC-16 test KB' },
    })
    const kbId = kbRes.json().data.id

    // 测试三种文件类型
    const testFiles = [
      { name: 'test.txt', mimeType: 'text/plain', content: 'GoferBot txt 测试内容。'.repeat(30) },
      { name: 'test.md', mimeType: 'text/markdown', content: '# GoferBot\n\nMarkdown 测试内容。'.repeat(20) },
      { name: 'test.pdf', mimeType: 'application/pdf', content: '%PDF-1.4\nGoferBot PDF 测试内容。'.repeat(10) },
    ]

    for (const file of testFiles) {
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
  }, 180000)
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
