import { test as base } from '@playwright/test'
import { publicEncrypt, constants } from 'node:crypto'

export interface TestUser {
  email: string
  password: string
  name: string
  accessToken: string
  refreshToken: string
  userId?: string
}

// Mock 用户（用于前端 mock 测试）
const mockUsers: Record<string, TestUser> = {
  registered: {
    email: 'test@example.com',
    password: 'Test123!@#',
    name: 'Test User',
    accessToken: 'mock-access-token-12345',
    refreshToken: 'mock-refresh-token-67890',
  },
}

const createdUsers: TestUser[] = []

// Playwright test fixture 扩展
export const test = base.extend<{ testUser: TestUser; authPage: { gotoLogin: () => Promise<void> } }>({
  testUser: async ({ page }, use) => {
    const user = mockUsers.registered
    await use(user)
  },

  authPage: async ({ page }, use) => {
    await use({
      gotoLogin: async () => {
        await page.goto('/login')
      },
    })
  },
})

let cachedPublicKey: string | null = null
let cachedTestUser: TestUser | null = null

// 通过真实后端 API 创建测试用户
export async function createTestUser(): Promise<TestUser> {
  const timestamp = Date.now()
  const email = `e2e-${timestamp}@test.gofer`
  const password = 'Test1234!'
  const name = 'E2E Test User'

  // 1. 获取公钥（缓存避免重复请求触发限流）
  if (!cachedPublicKey) {
    const keyRes = await fetch('http://127.0.0.1:3000/api/auth/public-key')
    if (!keyRes.ok) {
      throw new Error(`Failed to fetch public key: ${keyRes.status} ${await keyRes.text()}`)
    }
    const keyData = await keyRes.json()
    cachedPublicKey = keyData.data ? keyData.data.publicKey : keyData.publicKey
  }
  const publicKey = cachedPublicKey

  // 2. RSA 加密密码
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  const encryptedPassword = encrypted.toString('base64')

  // 3. 注册
  const registerRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, encryptedPassword, name }),
  })
  if (!registerRes.ok) {
    throw new Error(`Register failed: ${registerRes.status} ${await registerRes.text()}`)
  }

  // 4. 登录
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, encryptedPassword }),
  })
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`)
  }

  const loginData = await loginRes.json()
  const data = loginData.data ? loginData.data : loginData

  return {
    email,
    password,
    name,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user?.id,
  }
}

// 预创建测试用户（供 beforeAll 调用，避免限流）
export async function ensureTestUser(): Promise<TestUser> {
  if (!cachedTestUser) {
    cachedTestUser = await createTestUser()
  }
  return cachedTestUser
}

// 向页面注入认证 token（复用缓存用户避免限流）
export async function injectAuthToken(page: any, token?: string): Promise<void> {
  let t = token
  if (!t) {
    if (!cachedTestUser) {
      cachedTestUser = await createTestUser()
    }
    t = cachedTestUser.accessToken
  }
  await page.addInitScript({
    content: `
      try {
        localStorage.setItem('goferbot_access_token', '${t}')
        localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token')
      } catch (e) {}
    `,
  })
}

// Mock API 路由（保留现有功能）
export async function mockAuthApi(page: any) {
  await page.route('**/api/auth/public-key', (route) => {
    route.fulfill({
      json: {
        data: {
          publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLH8G8vI4bp0B\nnwFFesHnH4sdFcb+5L5O8kcpqESIQ0Nx9F0PBqJFeBkLfKLpG+4XgXqDjGThgFmW\nnwIDAQAB\n-----END PUBLIC KEY-----',
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
        },
      },
    })
  })

  await page.route('**/api/auth/login', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}')
      if (body.email === 'test@example.com' && body.encryptedPassword) {
        route.fulfill({
          json: {
            data: {
              accessToken: 'mock-access-token-12345',
              refreshToken: 'mock-refresh-token-67890',
              user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
            },
          },
        })
      } else {
        route.fulfill({ status: 401, json: { error: { message: 'Invalid credentials' } } })
      }
    }
  })

  await page.route('**/api/auth/register', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}')
      const newUser: TestUser = {
        email: body.email,
        password: body.encryptedPassword || 'encrypted',
        name: body.name || '',
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
      }
      createdUsers.push(newUser)
      route.fulfill({
        status: 201,
        json: {
          data: {
            accessToken: newUser.accessToken,
            refreshToken: newUser.refreshToken,
            user: { id: `user-${Date.now()}`, email: newUser.email, name: newUser.name },
          },
        },
      })
    }
  })

  await page.route('**/api/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      const authHeader = route.request().headers()['authorization']
      if (authHeader?.startsWith('Bearer ')) {
        route.fulfill({
          json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } },
        })
      } else {
        route.fulfill({ status: 401 })
      }
    }
  })

  await page.route('**/api/auth/refresh', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        json: {
          data: {
            accessToken: 'mock-access-token-refreshed',
            refreshToken: 'mock-refresh-token-refreshed',
          },
        },
      })
    }
  })
}
