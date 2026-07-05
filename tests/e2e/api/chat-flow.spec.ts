import { constants, publicEncrypt } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import axios from 'axios'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ChatService } from '../../../packages/server/src/modules/chat/chat.service.js'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

let app: NestFastifyApplication
let dbManager: TestDatabaseManager
let dbName: string
let baseURL: string

async function getPublicKey(): Promise<string> {
  const res = await axios.get(`${baseURL}/api/auth/public-key`)
  return res.data.data ? res.data.data.publicKey : res.data.publicKey
}

async function encryptPassword(password: string): Promise<string> {
  const publicKey = await getPublicKey()
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  return encrypted.toString('base64')
}

function extractAccessTokenFromCookies(setCookie: string[] | undefined): string {
  if (!setCookie || !Array.isArray(setCookie)) {
    throw new Error('Set-Cookie header not found in response')
  }
  for (const cookie of setCookie) {
    if (cookie.startsWith('goferbot_web_access_token=')) {
      return cookie.split('=')[1].split(';')[0]
    }
  }
  throw new Error('goferbot_web_access_token not found in Set-Cookie header')
}

async function registerUser(email: string, password: string, name: string) {
  const encryptedPassword = await encryptPassword(password)
  const res = await axios.post(`${baseURL}/api/web/auth/register`, {
    email,
    encryptedPassword,
    name,
    invitationCode: 'GF-test-code-001',
  })
  return res.data.data ? res.data.data.user : res.data.user
}

async function login(email: string, password: string): Promise<string> {
  const encryptedPassword = await encryptPassword(password)
  const res = await axios.post(`${baseURL}/api/web/auth/login`, {
    email,
    encryptedPassword,
  })
  return extractAccessTokenFromCookies(res.headers['set-cookie'])
}

function cookieHeader(token: string): { cookie: string } {
  return { cookie: `goferbot_web_access_token=${token}` }
}

describe('Chat HTTP E2E', () => {
  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    const dbUrl = await dbManager.createDatabase('chat_e2e')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
    await app.listen(0)
    baseURL = (await app.getUrl()).replace(/\/$/, '')
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  it('registers, logs in, creates a session and receives SSE chat stream', async () => {
    const email = `chat-e2e-${Date.now()}@test.gofer`
    const password = 'Test1234!'

    const _user = await registerUser(email, password, 'E2E User')
    const token = await login(email, password)

    const sessionRes = await axios.post(
      `${baseURL}/api/sessions`,
      { title: 'E2E Session' },
      { headers: cookieHeader(token) },
    )
    const sessionId = sessionRes.data.data.id as string

    const chatService = app.get(ChatService)
    vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
      yield {
        event: 'message',
        conversation_id: sessionId,
        message_id: '00000000-0000-0000-0000-000000000001',
        answer: 'Hello from E2E',
        done: false,
      }
      yield {
        event: 'message_end',
        conversation_id: sessionId,
        message_id: '00000000-0000-0000-0000-000000000001',
        answer: '',
        done: true,
      }
    })

    const chatRes = await axios.post(
      `${baseURL}/api/chat-messages`,
      {
        response_mode: 'streaming',
        query: 'Hi',
        conversation_id: sessionId,
      },
      {
        headers: cookieHeader(token),
        responseType: 'text',
      },
    )

    expect(chatRes.status).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')
    expect(chatRes.data).toContain('"answer":"Hello from E2E"')
    expect(chatRes.data).toContain('"done":true')
  })
})
