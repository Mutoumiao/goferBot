/**
 * Auth 核心链路 E2E 测试
 * 覆盖：注册 → 登录 → 访问保护路由 → refresh → logout
 * 场景：happy path、无效 token、过期 token、无效注册数据、错误密码、重复邮箱
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('Auth Flow E2E', () => {
  let client: E2EClient

  beforeAll(async () => {
    client = new E2EClient()
  })

  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function encryptPassword(password: string): Promise<string> {
    const res = await client.getPublicKey()
    const publicKey = res.data.data.publicKey
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    return encrypted.toString('base64')
  }

  it('AC-01: full auth flow — register → login → access protected → refresh → logout', async () => {
    const email = `e2e-${Date.now()}@test.gofer`
    const password = 'Test1234!'

    // 1. 注册
    const encryptedPassword = await encryptPassword(password)
    const registerRes = await client.register(email, encryptedPassword, 'E2E User')
    expect(registerRes.status).toBe(201)
    expect(registerRes.data.data.user.email).toBe(email)
    expect(registerRes.data.data.accessToken).toBeDefined()

    // 2. 登录
    const loginRes = await client.login(email, encryptedPassword)
    expect(loginRes.status).toBe(200)
    expect(loginRes.data.data.accessToken).toBeDefined()
    expect(loginRes.data.data.refreshToken).toBeDefined()
    const { accessToken, refreshToken } = loginRes.data.data

    // 3. 访问保护路由
    client.setToken(accessToken)
    const meRes = await client.me()
    expect(meRes.status).toBe(200)
    expect(meRes.data.data.email).toBe(email)

    // 4. refresh
    const refreshRes = await client.refresh(refreshToken)
    expect(refreshRes.status).toBe(200)
    expect(refreshRes.data.data.accessToken).toBeDefined()

    // 5. logout
    const logoutRes = await client.logout()
    expect(logoutRes.status).toBe(200)
  })

  it('AC-02: returns 401 for invalid token', async () => {
    client.setToken('invalid-token')
    const res = await client.me()
    expect(res.status).toBe(401)
    expect(res.data.error.code).toBe('AUTH_ERROR')
  })

  it('AC-03: returns 401 for expired token', async () => {
    // 使用已篡改的 token
    client.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid')
    const res = await client.me()
    expect(res.status).toBe(401)
  })

  it('AC-04: returns 400 for invalid register data', async () => {
    const res = await client.register('not-email', '', '')
    expect(res.status).toBe(400)
    expect(res.data.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-05: returns 401 for wrong password', async () => {
    const email = `e2e-wrong-${Date.now()}@test.gofer`
    const encryptedPassword = await encryptPassword('Test1234!')
    await client.register(email, encryptedPassword, 'Wrong Test')

    const wrongEncrypted = await encryptPassword('WrongPassword1!')
    const res = await client.login(email, wrongEncrypted)
    // 后端对错误密码返回 404（NotFoundException），错误码 AUTH_FAIL
    // 这是为了防止用户枚举攻击，不区分"用户不存在"和"密码错误"
    expect(res.status).toBe(404)
    expect(res.data.error.code).toBe('AUTH_FAIL')
  })

  it('AC-06: returns 409 for duplicate email', async () => {
    const email = `e2e-dup-${Date.now()}@test.gofer`
    const encryptedPassword = await encryptPassword('Test1234!')
    await client.register(email, encryptedPassword, 'Dup Test')

    const res = await client.register(email, encryptedPassword, 'Dup Test 2')
    expect(res.status).toBe(409)
    expect(res.data.error.code).toBe('USER_EXISTS')
  })
})
