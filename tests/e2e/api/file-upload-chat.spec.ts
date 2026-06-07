/**
 * File Upload + Chat SSE E2E 测试
 * 覆盖：multipart 上传、不支持的文件类型、文件大小限制、SSE 流式响应
 * 场景：happy path、错误类型、过大文件、SSE 头验证
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('File Upload + Chat SSE E2E', () => {
  let client: E2EClient

  beforeAll(async () => {
    client = new E2EClient()
  })

  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function createUserAndLogin(): Promise<string> {
    const keyRes = await client.getPublicKey()
    const publicKey = keyRes.data.data.publicKey
    const password = 'Test1234!'
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    const encryptedPassword = encrypted.toString('base64')
    const email = `file-chat-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.gofer`
    const registerRes = await client.register(email, encryptedPassword, 'File Chat E2E')
    const token = registerRes.data.data.accessToken
    client.setToken(token)
    return token
  }

  it('AC-12: uploads a text file via multipart', async () => {
    await createUserAndLogin()
    const kbRes = await client.createKB('E2E KB for File Upload')
    const kbId = kbRes.data.data.id

    const content = Buffer.from('# Hello World\nThis is a test document.')
    const res = await client.uploadDocument(kbId, content, 'test.md', 'text/markdown')
    expect(res.status).toBe(201)
    expect(res.data.data.name).toBe('test.md')
    expect(res.data.data.mimeType).toBe('text/markdown')
  })

  it('AC-13: rejects unsupported file type', async () => {
    await createUserAndLogin()
    const kbRes = await client.createKB('E2E KB for File Upload')
    const kbId = kbRes.data.data.id

    const content = Buffer.from('unsupported content')
    const res = await client.uploadDocument(kbId, content, 'virus.exe', 'application/x-msdownload')
    expect(res.status).toBe(415)
    expect(res.data.error.code).toBe('UNSUPPORTED_TYPE')
  })

  it('AC-14: rejects file exceeding size limit', async () => {
    await createUserAndLogin()
    const kbRes = await client.createKB('E2E KB for File Upload')
    const kbId = kbRes.data.data.id

    // 创建超过 50MB 的文件
    const content = Buffer.alloc(51 * 1024 * 1024)
    const res = await client.uploadDocument(kbId, content, 'huge.md', 'text/markdown')
    expect(res.status).toBe(413)
    expect(res.data.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('AC-15: chat SSE returns text/event-stream', async () => {
    await createUserAndLogin()

    // 先创建会话
    const sessionRes = await client.createSession('SSE Test')
    const sessionId = sessionRes.data.data.id

    // 发送 SSE 请求（提供 mock LLM config，后端会尝试连接但可能失败，
    // 但 ChatController 在调用 service 前已设置 200 + text/event-stream 头）
    const res = await client.chat({
      message: 'Hello',
      sessionId,
      config: {
        provider: 'openai',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-fake-test-key',
      },
    })

    // 验证响应头
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
  })
})
