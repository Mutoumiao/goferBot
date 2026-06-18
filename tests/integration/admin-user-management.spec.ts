import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Role } from '../../packages/server/src/auth/enums/role.enum.js'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

describe('AC-03: schema migration adds role and isActive columns', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('admin_schema')
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

  it('should have role and isActive columns in users table', async () => {
    const prisma = app.get(PrismaService)
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('role', 'is_active')
    `
    const columns = result as Array<{ column_name: string; data_type: string }>
    const columnNames = columns.map((c) => c.column_name)

    expect(columnNames).toContain('role')
    expect(columnNames).toContain('is_active')
  })
})

describe('Admin User Management API', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('admin_api')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    // 创建管理员用户并登录
    await AuthFixtures.createUser(app, {
      email: 'admin@test.gofer',
      password: 'Test1234!',
      name: 'Admin',
    })
    const prisma = app.get(PrismaService)
    await prisma.user.update({
      where: { email: 'admin@test.gofer' },
      data: { role: Role.ADMIN },
    })
    adminToken = await AuthFixtures.loginAs(app, {
      email: 'admin@test.gofer',
      password: 'Test1234!',
    })

    // 创建普通用户并登录
    await AuthFixtures.createUser(app, {
      email: 'user@test.gofer',
      password: 'Test1234!',
      name: 'User',
    })
    userToken = await AuthFixtures.loginAs(app, { email: 'user@test.gofer', password: 'Test1234!' })

    // 创建更多用户用于分页测试（直接操作数据库绕过限流）
    await prisma.user.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        email: `user${i}@test.gofer`,
        password: 'hash',
        name: `User ${i}`,
      })),
    })
  }, 60000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })

  describe('AC-05: admin users list with pagination search and filter', () => {
    it('should return paginated user list for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?page=1&size=10',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.data).toHaveLength(7)
      expect(body.data.pagination.total).toBe(7) // admin + user + 5 users
      expect(body.data.pagination.totalPage).toBe(1)
    })

    it('should support email search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?search=user@test.gofer',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.data).toHaveLength(1)
      expect(body.data.data[0].email).toBe('user@test.gofer')
    })

    it('should support isActive filter', async () => {
      // 先禁用一个用户
      const prisma = app.get(PrismaService)
      await prisma.user.update({
        where: { email: 'user0@test.gofer' },
        data: { isActive: false },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users?isActive=false',
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data.data[0].isActive).toBe(false)
    })

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${userToken}` },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('AC-06: admin can toggle user active status', () => {
    it('should disable user', async () => {
      const prisma = app.get(PrismaService)
      const user = await prisma.user.findUnique({ where: { email: 'user1@test.gofer' } })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${user!.id}/status`,
        payload: { isActive: false },
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.isActive).toBe(false)
    })

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/users/non-existent-id/status',
        payload: { isActive: false },
        headers: { authorization: `Bearer ${adminToken}` },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 for non-admin user', async () => {
      const prisma = app.get(PrismaService)
      const user = await prisma.user.findUnique({ where: { email: 'user2@test.gofer' } })

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/users/${user!.id}/status`,
        payload: { isActive: false },
        headers: { authorization: `Bearer ${userToken}` },
      })

      expect(response.statusCode).toBe(403)
    })
  })
})
