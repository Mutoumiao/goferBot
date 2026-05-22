import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'

describe('Auth E2E flow', () => {
  const dbManager = new TestDatabaseManager()
  let dbUrl: string
  let app: Awaited<ReturnType<typeof TestAppFactory.create>>

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase('authe2e')
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-16: full auth flow (register → login → me → refresh → logout)', async () => {
    const email = 'e2e-user@example.com'
    const password = 'E2ePass123!'

    // 1. register
    const encryptedPassword = await AuthFixtures.encryptPassword(app, password, { remoteAddress: '::ffff:192.168.2.1' })
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, encryptedPassword, name: 'E2E User' },
      remoteAddress: '::ffff:192.168.2.1',
    })
    expect(registerRes.statusCode).toBe(201)
    const registerData = registerRes.json().data ?? registerRes.json()
    expect(registerData.user.email).toBe(email)

    // 2. login
    const loginEncrypted = await AuthFixtures.encryptPassword(app, password, { remoteAddress: '::ffff:192.168.2.2' })
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, encryptedPassword: loginEncrypted },
      remoteAddress: '::ffff:192.168.2.2',
    })
    expect(loginRes.statusCode).toBe(200)
    const loginData = loginRes.json().data ?? loginRes.json()
    expect(typeof loginData.accessToken).toBe('string')
    expect(typeof loginData.refreshToken).toBe('string')
    const { accessToken, refreshToken } = loginData

    // 3. me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '::ffff:192.168.2.3',
    })
    expect(meRes.statusCode).toBe(200)
    const meData = meRes.json().data ?? meRes.json()
    expect(meData.email).toBe(email)

    // 4. refresh
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
      remoteAddress: '::ffff:192.168.2.4',
    })
    expect(refreshRes.statusCode).toBe(200)
    const refreshData = refreshRes.json().data ?? refreshRes.json()
    expect(typeof refreshData.accessToken).toBe('string')
    expect(typeof refreshData.refreshToken).toBe('string')

    // 5. logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${refreshData.accessToken}` },
      remoteAddress: '::ffff:192.168.2.5',
    })
    expect(logoutRes.statusCode).toBe(200)
    const logoutData = logoutRes.json().data ?? logoutRes.json()
    expect(logoutData.success).toBe(true)
  })
})
