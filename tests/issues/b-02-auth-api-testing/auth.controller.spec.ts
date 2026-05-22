import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'

describe('AuthController integration', () => {
  const dbManager = new TestDatabaseManager()
  let dbUrl: string
  let app: Awaited<ReturnType<typeof TestAppFactory.create>>

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase('authctrl')
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-01: GET /api/auth/public-key returns RSA public key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/public-key' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/)
    expect(data.algorithm).toBe('RSA-OAEP')
    expect(data.hash).toBe('SHA-256')
  })

  it('AC-02: POST /api/auth/register creates user and returns tokens', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.2' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac02@example.com', encryptedPassword, name: 'AC02' },
      remoteAddress: '::ffff:192.168.1.2',
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    const data = body.data ?? body
    expect(data.user.email).toBe('test-ac02@example.com')
    expect(data.user.name).toBe('AC02')
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
    expect(data.accessToken.split('.')).toHaveLength(3)
  })

  it('AC-03: POST /api/auth/register returns 422 for invalid email', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.3' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.3',
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-04: POST /api/auth/register returns 400 for decrypt failure', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac04@example.com', encryptedPassword: 'invalid-base64!!!' },
      remoteAddress: '::ffff:192.168.1.4',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('DECRYPT_FAILED')
  })

  it('AC-05: POST /api/auth/register returns 400 for weak password', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, '123', { remoteAddress: '::ffff:192.168.1.5' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac05@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.5',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-06: POST /api/auth/register returns 409 for duplicate email', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.6' })
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac06@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.6',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac06@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.7',
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.error.code).toBe('USER_EXISTS')
  })

  it('AC-07: POST /api/auth/login returns tokens for valid credentials', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac07@example.com', password: 'Test1234!', name: 'AC07' }, { remoteAddress: '::ffff:192.168.1.8' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.8' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac07@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.8',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.user.email).toBe('test-ac07@example.com')
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
  })

  it('AC-08: POST /api/auth/login returns 422 for invalid input', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.9' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad-email', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.9',
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-09: POST /api/auth/login returns 404 for wrong password', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac09@example.com', password: 'Test1234!', name: 'AC09' }, { remoteAddress: '::ffff:192.168.1.10' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'WrongPass1!', { remoteAddress: '::ffff:192.168.1.10' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac09@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.10',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_FAIL')
  })

  it('AC-10: POST /api/auth/refresh returns new token pair', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac10@example.com', password: 'Test1234!', name: 'AC10' }, { remoteAddress: '::ffff:192.168.1.11' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!', { remoteAddress: '::ffff:192.168.1.11' })
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac10@example.com', encryptedPassword },
      remoteAddress: '::ffff:192.168.1.11',
    })
    const { refreshToken } = (loginRes.json().data ?? loginRes.json())

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
      remoteAddress: '::ffff:192.168.1.11',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
    expect(data.accessToken).not.toBe(refreshToken)
  })

  it('AC-11: POST /api/auth/refresh returns 401 for invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'totally.invalid.token' },
      remoteAddress: '::ffff:192.168.1.12',
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('AC-12: POST /api/auth/logout returns success with valid token', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac12@example.com', password: 'Test1234!', name: 'AC12' }, { remoteAddress: '::ffff:192.168.1.13' })
    const accessToken = await AuthFixtures.loginAs(app, { email: 'test-ac12@example.com', password: 'Test1234!' }, { remoteAddress: '::ffff:192.168.1.13' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '::ffff:192.168.1.13',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.success).toBe(true)
  })

  it('AC-13: POST /api/auth/logout returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      remoteAddress: '::ffff:192.168.1.14',
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
  })

  it('AC-14: GET /api/auth/me returns current user', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac14@example.com', password: 'Test1234!', name: 'AC14' }, { remoteAddress: '::ffff:192.168.1.15' })
    const accessToken = await AuthFixtures.loginAs(app, { email: 'test-ac14@example.com', password: 'Test1234!' }, { remoteAddress: '::ffff:192.168.1.15' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress: '::ffff:192.168.1.15',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.email).toBe('test-ac14@example.com')
    expect(data.name).toBe('AC14')
  })

  it('AC-15: GET /api/auth/me returns 401 for invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid.token.here' },
      remoteAddress: '::ffff:192.168.1.16',
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
  })
})
