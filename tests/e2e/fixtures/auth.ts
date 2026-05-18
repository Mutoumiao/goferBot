import { test as base } from '@playwright/test'

export interface TestUser {
  email: string
  password: string
  name: string
  accessToken: string
  refreshToken: string
}

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

export async function mockAuthApi(page: any) {
  await page.route('**/auth/login', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}')
      if (body.email === 'test@example.com' && body.password === 'Test123!@#') {
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

  await page.route('**/auth/register', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}')
      const newUser: TestUser = {
        email: body.email,
        password: body.password,
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

  await page.route('**/auth/me', (route) => {
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

  await page.route('**/auth/refresh', (route) => {
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

export async function injectAuthToken(page: any, token: string = 'mock-access-token-12345') {
  await page.addInitScript({ content: `
    try {
      localStorage.setItem('goferbot_access_token', '${token}');
      localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890');
    } catch (e) {}
  ` })
}
