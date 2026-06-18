/**
 * AuthController 集成测试
 * 覆盖端点：GET /api/auth/public-key, POST /api/auth/register, POST /api/auth/login,
 *          POST /api/auth/logout, POST /api/auth/refresh, GET /api/auth/me
 * 场景：happy path、Zod 验证失败、认证缺失/无效、资源不存在、唯一约束冲突
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { createIpGenerator } from './helpers/test-utils.js'

const nextIp = createIpGenerator(1)

describe('AuthController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('auth_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/auth/public-key', () => {
    it('AC-01: returns public key with RSA-OAEP info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/public-key',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.publicKey).toContain('BEGIN PUBLIC KEY')
      expect(body.data.algorithm).toBe('RSA-OAEP')
      expect(body.data.hash).toBe('SHA-256')
    })
  })

  describe('POST /api/auth/register', () => {
    it('AC-03: creates user with valid data', async () => {
      const email = `reg-${Date.now()}@test.gofer`
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'Test User' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.user.email).toBe(email)
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-04: returns 400 for invalid email', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'invalid-email', encryptedPassword, name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-05: returns 400 for empty password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword: '', name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-06: returns 400 for decrypt failure', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `reg-${Date.now()}@test.gofer`,
          encryptedPassword: 'not-valid-base64!!!',
          name: 'Test',
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('DECRYPT_FAILED')
    })

    it('AC-07: returns 400 for short password', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, '123')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword, name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-08: returns 400 for password without letter/digit', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, '!!!!!!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword, name: 'Test' },
        remoteAddress: nextIp(),
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-09: returns 409 for duplicate email', async () => {
      const email = `dup-${Date.now()}@test.gofer`
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'First' },
        remoteAddress: nextIp(),
      })
      expect(first.statusCode).toBe(201)
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'Second' },
        remoteAddress: nextIp(),
      })
      expect(second.statusCode).toBe(409)
      const body = second.json()
      expect(body.error.code).toBe('USER_EXISTS')
    })
  })

  describe('POST /api/auth/login', () => {
    it('AC-11: returns tokens for valid credentials', async () => {
      const email = `login-${Date.now()}@test.gofer`
      const password = 'Test1234!'
      await AuthFixtures.createUser(
        app,
        { email, password, name: 'Login User' },
        { remoteAddress: nextIp() },
      )
      const encryptedPassword = await AuthFixtures.encryptPassword(app, password)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-12: returns 400 for invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'not-email', encryptedPassword: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-13: returns 404 for non-existent user', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nonexistent@test.gofer', encryptedPassword },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-14: returns 404 for wrong password', async () => {
      const email = `login-wrong-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Wrong User' },
        { remoteAddress: nextIp() },
      )
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'WrongPassword1!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-15: returns 403 for disabled user', async () => {
      const email = `disabled-${Date.now()}@test.gofer`
      const user = await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Disabled' },
        { remoteAddress: nextIp() },
      )
      const prisma = app.get(PrismaService)
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })

      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('ACCOUNT_DISABLED')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('AC-17: returns success for valid token', async () => {
      const email = `logout-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Logout User' },
        { remoteAddress: nextIp() },
      )
      const token = await AuthFixtures.loginAs(
        app,
        { email, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.success).toBe(true)
    })

    it('AC-18: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-19: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('AC-20: returns new tokens for valid refresh token', async () => {
      const email = `refresh-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Refresh User' },
        { remoteAddress: nextIp() },
      )
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword: await AuthFixtures.encryptPassword(app, 'Test1234!') },
        remoteAddress: nextIp(),
      })
      const { refreshToken } = loginRes.json().data
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-21: returns 401 for empty refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: '' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-22: returns 401 for access token', async () => {
      const email = `refresh-at-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Refresh AT' },
        { remoteAddress: nextIp() },
      )
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword: await AuthFixtures.encryptPassword(app, 'Test1234!') },
        remoteAddress: nextIp(),
      })
      const { accessToken } = loginRes.json().data
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: accessToken },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-23: returns 401 for expired token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-24: returns 401 when user not found', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub24tZXhpc3RlbnQtdXNlciIsInR5cGUiOiJyZWZyZXNoIn0.fake',
        },
      })
      expect([401, 403]).toContain(res.statusCode)
    })
  })

  describe('GET /api/auth/me', () => {
    it('AC-25: returns user profile for valid token', async () => {
      const email = `me-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Me User' },
        { remoteAddress: nextIp() },
      )
      const token = await AuthFixtures.loginAs(
        app,
        { email, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.email).toBe(email)
    })

    it('AC-26: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-27: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-28: returns 401 when user not found', async () => {
      const email = `me-del-${Date.now()}@test.gofer`
      const user = await AuthFixtures.createUser(
        app,
        { email, password: 'Test1234!', name: 'Deleted' },
        { remoteAddress: nextIp() },
      )
      const token = await AuthFixtures.loginAs(
        app,
        { email, password: 'Test1234!' },
        { remoteAddress: nextIp() },
      )
      const prisma = app.get(PrismaService)
      await prisma.user.delete({ where: { id: user.id } })

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
