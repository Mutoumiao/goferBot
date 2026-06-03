import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { publicEncrypt, constants } from 'node:crypto'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

/**
 * 集成测试：认证 API
 * 覆盖：登录保护、注册冲突
 * 纯集成测试 — 使用默认 mock 模式，零外部依赖（除 PostgreSQL）
 */
describe('Auth API Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('auth_api')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })

  // AC-06: 未登录访问保护路由返回 401
  it('AC-06: 未登录访问保护路由返回 401', async () => {
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
    const email = `auth-ac08-${Date.now()}@test.gofer`

    // 第一次注册
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        encryptedPassword: await encryptPassword(app, 'Test1234!'),
        name: 'First User',
      },
    })
    expect(firstRes.statusCode).toBe(201)

    // 第二次使用相同邮箱注册
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        encryptedPassword: await encryptPassword(app, 'Test1234!'),
        name: 'Second User',
      },
    })
    expect(secondRes.statusCode).toBe(409)
    const body = secondRes.json()
    expect(body.error?.code || body.code).toBe('USER_EXISTS')
  })
})

/**
 * 集成测试：知识库权限隔离
 * 纯集成测试 — 使用默认 mock 模式，零外部依赖（除 PostgreSQL）
 */
describe('Knowledge Base Permission Integration Tests', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('kb_perm')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })

  // AC-15: 用户 B 无法操作用户 A 的知识库
  it('AC-15: 用户 B 无法操作用户 A 的知识库', async () => {
    const timestamp = Date.now()

    // 创建用户 A
    const emailA = `perm-usera-${timestamp}@test.gofer`
    const tokenA = await AuthFixtures.loginAs(app, { email: emailA, password: 'Test1234!' })
      .catch(async () => {
        await AuthFixtures.createUser(app, { email: emailA, password: 'Test1234!', name: 'User A' })
        return AuthFixtures.loginAs(app, { email: emailA, password: 'Test1234!' })
      })

    // 用户 A 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: `AC15-KB-A-${timestamp}`, description: 'User A KB' },
    })
    const kbId = kbRes.json().data.id

    // 创建用户 B
    const emailB = `perm-userb-${timestamp}@test.gofer`
    await AuthFixtures.createUser(app, { email: emailB, password: 'Test1234!', name: 'User B' })
    const tokenB = await AuthFixtures.loginAs(app, { email: emailB, password: 'Test1234!' })

    // 用户 B 尝试操作用户 A 的知识库 — 列表
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${tokenB}` },
    })
    const kbList = listRes.json().data
    const userBCanSeeUserAKB = kbList.some((kb: any) => kb.id === kbId)
    expect(userBCanSeeUserAKB).toBe(false)

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
})

// ---- 辅助函数 ----

// AC-07: 登录拒绝禁用用户
describe('AC-07: login rejects disabled user with 403', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('auth_disabled')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })

  it('should return 403 for disabled user', async () => {
    const email = `disabled-${Date.now()}@test.gofer`

    // 先注册用户
    await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Disabled User' })

    // 禁用该用户
    const prisma = app.get(PrismaService)
    await prisma.user.update({
      where: { email },
      data: { isActive: false },
    })

    // 尝试登录
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        encryptedPassword: await encryptPassword(app, 'Test1234!'),
      },
    })

    expect(response.statusCode).toBe(403)
    const body = response.json()
    expect(body.error?.code).toBe('ACCOUNT_DISABLED')
  })
})

async function encryptPassword(app: NestFastifyApplication, password: string): Promise<string> {
  const keyRes = await app.inject({
    method: 'GET',
    url: '/api/auth/public-key',
  })
  const body = keyRes.json()
  const publicKey = body.data ? body.data.publicKey : body.publicKey

  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  return encrypted.toString('base64')
}
