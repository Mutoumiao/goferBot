import { constants, createPrivateKey, privateDecrypt } from 'node:crypto'
import type { Page, Route } from '@playwright/test'

export const MOCK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA13qT6v0YXoPUW/0vnFMS
vBdUCPxbqqHM1OMMkL0VZZjapiMvL/GFrS8CL7oQy5SGEKcmT2sjheuhTVzqZM3v
BwEAsOEX3nL7zgcTYhS06JLxjiX7/DBmNfd3dJsrin1fz/7OLY/MrvXDZfmt4mVn
5/oOB4rz/WUKZpencvdsbXd0hB5KFSMzq9Vdw1GI+WthQfQOgd+/W0hdBFqDLWfh
4SeaM/EwWiGPbvFIvn4HXQXD31iw9wgcGVoMNX598N1FckN+sKziNuzGa8IqCSYG
iJdOlmvzx9wtgO4msj4CAjt67YRi0EJiy9lpKTMtHxsil1bBi+EU96djFiEtiLgd
gQIDAQAB
-----END PUBLIC KEY-----`

const MOCK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDXepPq/Rheg9Rb
/S+cUxK8F1QI/FuqoczU4wyQvRVlmNqmIy8v8YWtLwIvuhDLlIYQpyZPayOF66FN
XOpkze8HAQCw4RfecvvOBxNiFLTokvGOJfv8MGY193d0myuKfV/P/s4tj8yu9cNl
+a3iZWfn+g4HivP9ZQpml6dy92xtd3SEHkoVIzOr1V3DUYj5a2FB9A6B379bSF0E
WoMtZ+HhJ5oz8TBaIY9u8Ui+fgddBcPfWLD3CBwZWgw1fn3w3UVyQ36wrOI27MZr
wioJJgaIl06Wa/PH3C2A7iayPgICO3rthGLQQmLL2WkpMy0fGyKXVsGL4RT3p2MW
IS2IuB2BAgMBAAECggEAHtIbojr9Z1d34oh+bN+9CEZV8MsX2Xo3MCQhwfopu1R3
wde6giMLuc/Fgkoc6OGfo3YlFqr+c8NWWRh3Nl/2VowgKyynG1xbBAcjEJ5hmfqa
rnhkaJgLpqB056riOXbhY4DQwNeWsVfZ0RY7duyGRjoQE6geahovuKjsfJdDXQy7
yHlC5GBSETdZdbamC8WMXGMsW060sueQCGnSTwnlT6jLr+5k9pMehicl8+euSub9
fHfBGBrrpDp7VUPPPdF49TbHP7BIENSIirBJtFmFbW88SEBHO61KpibBxm681RtT
B0Zi+tpp75ApylbQLvCgRqc4RW583sSXV+ip5FEl2QKBgQD3UDG+rFyBPIFIpIZU
FfMT/dDyjnTrYXhoj+IdLTro2bllLmJeWAJjywwU98/opGKDo1lvxOLqxc7tx+EU
tUMuLmhiLybWtmzlID4Lw5/fCssNbvmAaqZF8HAB/tQglAMxvZ3zgt4VoUKoCiQm
vHnhbuTng6q7TQQ91lIHhSpyywKBgQDfDCH6u6epRYGP0g0HfRHxIBnpsCbvraqD
4rIcdbXkuQyQ3wyVdrs99R96XrH+GQFnW0KOtE1mOI7mSV8FrBkPKaVafGb5LJaQ
bN2g2TxCuGLY5m9Z96jCfkQjy2Cdiw3zzQ4wyL0JOIOZyCSjze83rIcSw3sNjDqn
8HKFFD0LYwKBgEPv2KprSMILr+wXnfrtSKf+Om7XKVEbpmr60392VE9wt9gOpOEL
xiRJu9jqtkdPGOzWa5Qjfr5FdnGlTbRVks3V28DU+RNUa5eJguHSbFFl8p+PE6Tu
JxzhTrONoBIO9s2sK/6fvYgtk1T77DBj6AtAXksmxTjMkFS4UjJUp3N/AoGAPx9c
4muHCGWORBhq7YqcsEOocbUTX9MjJY3bYCiD4IXqI3msQwRF+0PKs8Pm1YVYG1r9
XAt0uBAbiNqM1LseoGblz9TTA4N13MuicSnpXux1tPKJ4sku7lPzjrm4zv0SZsPK
V04ICXr/615z2BOotnXSCCJgSbY8x1hJ4JWYrQcCgYEAj1gCbnPW3eZcRH3h3qiS
bym3oF0LFp3/88GB5/A4dubKmz6pVT5rzPM9OLmm53jj/uoz68OWdr1xKmAP+3Mb
CWb5kReqle6pcrZWXpB6kwh27JF+tG2nULSZfwQTc3bstqxDL/grJfV3KaxZQvdQ
7Hbn1alV2uO2M3KKclSMueY=
-----END PRIVATE KEY-----`

const privateKey = createPrivateKey(MOCK_PRIVATE_KEY)

function decryptPayload(encryptedBase64: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64')
  const decrypted = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encrypted,
  )
  return decrypted.toString('utf8')
}

export interface MockUser {
  id: string
  name: string
  email: string
}

export interface MockAuthState {
  users: Map<string, MockUser & { password: string }>
  currentUserId: string | null
}

export function createInitialAuthState(): MockAuthState {
  return {
    users: new Map(),
    currentUserId: null,
  }
}

const MOCK_ACCESS_TOKEN = 'mock-access-token-xxxxxxxxxxxxxxxx'
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-yyyyyyyyyyyyyyyy'

function okData(data: unknown) {
  return JSON.stringify({ data })
}

function failJson(status: number, code: string, message: string) {
  return {
    status,
    contentType: 'application/json' as const,
    body: JSON.stringify({ code, message }),
  }
}

export async function installAuthMocks(page: Page, state: MockAuthState) {
  // 公钥 / 验证码（/auth/*）
  await page.route('**/auth/public-key**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({
        publicKey: MOCK_PUBLIC_KEY,
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      }),
    })
  })

  await page.route('**/auth/captcha**', async (route: Route) => {
    // 1x1 png base64
    const tinyPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({
        captchaId: 'mock-captcha',
        imageBase64: tinyPng,
        imageUrl: `data:image/png;base64,${tinyPng}`,
        expiresIn: 300,
      }),
    })
  })

  // 注册：/web/auth/register 与历史 /auth/register
  await page.route(/\/(web\/)?auth\/register/, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const body = (await route.request().postData()) ?? '{}'
    const payload = JSON.parse(body) as {
      name?: string
      email?: string
      password?: string
      encryptedPassword?: string
    }
    const cipher = payload.encryptedPassword || payload.password
    if (!payload.email || !cipher || !payload.name) {
      await route.fulfill(failJson(400, 'VALIDATION_ERROR', '参数不完整'))
      return
    }
    if (state.users.has(payload.email)) {
      await route.fulfill(failJson(409, 'USER_EXISTS', '该邮箱已被注册'))
      return
    }
    let plainPassword = cipher
    try {
      plainPassword = decryptPayload(cipher)
    } catch {
      // 明文兼容
    }
    const id = `user-${state.users.size + 1}`
    const user: MockUser & { password: string } = {
      id,
      name: payload.name,
      email: payload.email,
      password: plainPassword,
    }
    state.users.set(payload.email, user)
    state.currentUserId = id
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({
        accessToken: MOCK_ACCESS_TOKEN,
        refreshToken: MOCK_REFRESH_TOKEN,
        user: { id, name: user.name, email: user.email },
      }),
    })
  })

  // 登录：/web/auth/login
  await page.route(/\/(web\/)?auth\/login/, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const body = (await route.request().postData()) ?? '{}'
    const payload = JSON.parse(body) as {
      email?: string
      password?: string
      encryptedPassword?: string
    }
    const cipher = payload.encryptedPassword || payload.password
    if (!payload.email || !cipher) {
      await route.fulfill(failJson(400, 'VALIDATION_ERROR', '参数不完整'))
      return
    }
    const user = state.users.get(payload.email)
    let plainPassword = cipher
    try {
      plainPassword = decryptPayload(cipher)
    } catch {
      // 明文兼容（测试预置密码）
    }
    if (!user || user.password !== plainPassword) {
      await route.fulfill(failJson(401, 'AUTH_FAIL', '邮箱或密码错误'))
      return
    }
    state.currentUserId = user.id
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': [
          `access_token=${MOCK_ACCESS_TOKEN}; Path=/; HttpOnly`,
          `refresh_token=${MOCK_REFRESH_TOKEN}; Path=/; HttpOnly`,
        ].join('\n'),
      },
      body: okData({
        accessToken: MOCK_ACCESS_TOKEN,
        refreshToken: MOCK_REFRESH_TOKEN,
        user: { id: user.id, name: user.name, email: user.email },
      }),
    })
  })

  // /auth/me
  await page.route('**/auth/me**', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      await route.continue()
      return
    }
    if (!state.currentUserId) {
      await route.fulfill(failJson(401, 'AUTH_FAIL', '未登录'))
      return
    }
    const user = [...state.users.values()].find((u) => u.id === state.currentUserId)
    if (!user) {
      await route.fulfill(failJson(401, 'AUTH_FAIL', '未登录'))
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({ id: user.id, name: user.name, email: user.email }),
    })
  })

  // refresh / logout
  await page.route(/\/(web\/)?auth\/refresh/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({
        accessToken: MOCK_ACCESS_TOKEN,
        refreshToken: MOCK_REFRESH_TOKEN,
      }),
    })
  })

  await page.route(/\/(web\/)?auth\/logout/, async (route: Route) => {
    state.currentUserId = null
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okData({ success: true }),
    })
  })
}

const MOCK_KB_ID = '11111111-1111-4111-8111-111111111111'
const MOCK_DOC_ID = '22222222-2222-4222-8222-222222222222'
const MOCK_MSG_ID = '33333333-3333-4333-8333-333333333333'

/**
 * Knowledge Chat 线级 SSE 帧（与 Nest chat.service / KnowledgeChatTransport 对齐）。
 * sources → message* → message_end
 */
export function buildKnowledgeChatSse(options?: {
  answer?: string
  sources?: Array<{ kb_id: string; document_id: string; content?: string }>
  retrievalEmpty?: boolean
  conversationId?: string
}): string {
  const conversationId = options?.conversationId ?? '44444444-4444-4444-8444-444444444444'
  const answer = options?.answer ?? '你好，我是 Mock AI，已收到你的消息。'
  const sources =
    options?.sources ??
    (options?.retrievalEmpty
      ? []
      : [{ kb_id: MOCK_KB_ID, document_id: MOCK_DOC_ID, content: 'mock-chunk' }])
  const retrievalEmpty = options?.retrievalEmpty ?? false
  const half = Math.ceil(answer.length / 2) || 1
  const d1 = answer.slice(0, half)
  const d2 = answer.slice(half)

  const frames: string[] = [
    `event: sources\ndata: ${JSON.stringify({
      event: 'sources',
      conversation_id: conversationId,
      message_id: MOCK_MSG_ID,
      sources,
      retrieval_empty: retrievalEmpty,
      done: false,
    })}`,
    '',
  ]
  if (d1) {
    frames.push(
      `event: message\ndata: ${JSON.stringify({
        event: 'message',
        conversation_id: conversationId,
        message_id: MOCK_MSG_ID,
        answer: d1,
        done: false,
      })}`,
      '',
    )
  }
  if (d2) {
    frames.push(
      `event: message\ndata: ${JSON.stringify({
        event: 'message',
        conversation_id: conversationId,
        message_id: MOCK_MSG_ID,
        answer: d2,
        done: false,
      })}`,
      '',
    )
  }
  frames.push(
    `event: message_end\ndata: ${JSON.stringify({
      event: 'message_end',
      conversation_id: conversationId,
      message_id: MOCK_MSG_ID,
      answer: '',
      done: true,
      retrieval_empty: retrievalEmpty,
    })}`,
    '',
  )
  return frames.join('\n')
}

export function installChatMocks(page: Page) {
  let sessionCounter = 1
  const sessionMap = new Map<string, { id: string; title: string; createdAt: string }>()

  // providers：前端走 /settings/chat/providers（builtIn/custom）
  page.route('**/settings/chat/providers', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          builtIn: [
            {
              id: 'mock-provider',
              name: 'Mock Provider',
              enabled: true,
              models: [{ name: 'mock-model', type: 'llm', enabled: true }],
            },
          ],
          custom: [],
        },
      }),
    })
  })

  // KB 选择器
  page.route('**/knowledge-bases/for-selector**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: MOCK_KB_ID, name: 'Mock 知识库', documentCount: 1 }],
      }),
    })
  })

  page.route('**/api/sessions**', async (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()
    // list
    if (method === 'GET' && /\/sessions(\?|$)/.test(url.replace(/.*\/api/, '/api'))) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: [...sessionMap.values()],
            pagination: { page: 1, size: 20, total: sessionMap.size },
          },
        }),
      })
      return
    }
    if (method === 'POST' && !url.includes('/rename')) {
      sessionCounter += 1
      const id = `44444444-4444-4444-8444-${String(sessionCounter).padStart(12, '0')}`
      const sess = {
        id,
        title: '新对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      sessionMap.set(id, sess)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: sess }),
      })
      return
    }
    await route.fulfill({ status: 200, body: JSON.stringify({ data: null }) })
  })

  page.route('**/api/sessions/**', async (route: Route) => {
    const url = route.request().url()
    const match = url.match(/\/sessions\/([^/?]+)/)
    const id = match ? match[1] : `sess-${sessionCounter}`
    if (url.includes('/rename')) {
      await route.fulfill({ status: 200, body: JSON.stringify({ data: { id } }) })
      return
    }
    const existing = sessionMap.get(id)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: existing ?? {
          id,
          title: '新对话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })
  })

  // GET 历史 / POST SSE
  page.route('**/api/chat-messages**', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { items: [], pagination: { page: 1, size: 20, total: 0 } },
        }),
      })
      return
    }
    if (method === 'POST') {
      let conversationId = MOCK_MSG_ID
      try {
        const raw = route.request().postData() ?? '{}'
        const body = JSON.parse(raw) as { conversation_id?: string; query?: string }
        conversationId = body.conversation_id || conversationId
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: buildKnowledgeChatSse({
          conversationId,
          answer: '你好，我是 Mock AI，已收到你的消息。',
        }),
      })
      return
    }
    await route.fulfill({ status: 200, body: JSON.stringify({ data: null }) })
  })
}

export async function installAllMocks(page: Page, state: MockAuthState) {
  await installAuthMocks(page, state)
  installChatMocks(page)
}
