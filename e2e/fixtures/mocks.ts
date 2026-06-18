import type { Page, Route } from '@playwright/test'
import { privateDecrypt, createPrivateKey, constants } from 'node:crypto'

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

export async function installAuthMocks(page: Page, state: MockAuthState) {
  // /api/auth/public-key - 返回固定公钥
  await page.route('**/api/auth/public-key', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          publicKey: MOCK_PUBLIC_KEY,
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
        },
      }),
    })
  })

  // /api/auth/register - 解密密码，创建用户
  await page.route('**/api/auth/register', async (route: Route) => {
    const body = (await route.request().postData()) ?? '{}'
    const payload = JSON.parse(body) as { name?: string; email?: string; password?: string }
    if (!payload.email || !payload.password || !payload.name) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'VALIDATION_ERROR', message: '参数不完整' }),
      })
      return
    }
    if (state.users.has(payload.email)) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'USER_EXISTS', message: '该邮箱已被注册' }),
      })
      return
    }
    const plainPassword = decryptPayload(payload.password)
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
      body: JSON.stringify({
        data: {
          accessToken: MOCK_ACCESS_TOKEN,
          refreshToken: MOCK_REFRESH_TOKEN,
          user: { id, name: user.name, email: user.email },
        },
      }),
    })
  })

  // /api/auth/login - 解密密码，校验后返回 token
  await page.route('**/api/auth/login', async (route: Route) => {
    const body = (await route.request().postData()) ?? '{}'
    const payload = JSON.parse(body) as { email?: string; password?: string }
    if (!payload.email || !payload.password) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'VALIDATION_ERROR', message: '参数不完整' }),
      })
      return
    }
    const user = state.users.get(payload.email)
    const plainPassword = decryptPayload(payload.password)
    if (!user || user.password !== plainPassword) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'AUTH_FAIL', message: '邮箱或密码错误' }),
      })
      return
    }
    state.currentUserId = user.id
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: MOCK_ACCESS_TOKEN,
          refreshToken: MOCK_REFRESH_TOKEN,
          user: { id: user.id, name: user.name, email: user.email },
        },
      }),
    })
  })

  // /api/auth/me - 返回当前用户
  await page.route('**/api/auth/me', async (route: Route) => {
    if (!state.currentUserId) {
      await route.fulfill({ status: 401, body: JSON.stringify({ code: 'AUTH_FAIL' }) })
      return
    }
    const user = [...state.users.values()].find((u) => u.id === state.currentUserId)
    if (!user) {
      await route.fulfill({ status: 401, body: JSON.stringify({ code: 'AUTH_FAIL' }) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: user.id, name: user.name, email: user.email },
      }),
    })
  })

  // /api/auth/refresh
  await page.route('**/api/auth/refresh', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: MOCK_ACCESS_TOKEN,
          refreshToken: MOCK_REFRESH_TOKEN,
        },
      }),
    })
  })
}

export function installChatMocks(page: Page) {
  let sessionCounter = 1

  page.route('**/api/chat-messages/providers', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          providers: [
            { key: 'mock-provider', name: 'Mock Provider', enabled: true },
          ],
        },
      }),
    })
  })

  page.route('**/api/sessions', async (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && !url.includes('?')) {
      sessionCounter += 1
      const id = `sess-${sessionCounter}`
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id,
            title: '新对话',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
      return
    }
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { items: [], total: 0, page: 1, size: 20 },
        }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id, title: '新对话', createdAt: new Date().toISOString() },
      }),
    })
  })

  // /api/chat-messages (list)
  page.route('**/api/chat-messages', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { items: [], total: 0 } }),
      })
      return
    }
    // POST = SSE chat
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: [
        'id: 1',
        'event: message',
        'data: ' + JSON.stringify({ content: '你好，我是 Mock AI，已收到你的消息。', role: 'assistant' }),
        '',
        'id: 2',
        'event: done',
        'data: ' + JSON.stringify({ done: true }),
        '',
      ].join('\n'),
    })
  })
}

export async function installAllMocks(page: Page, state: MockAuthState) {
  await installAuthMocks(page, state)
  installChatMocks(page)
}
