/**
 * HealthController 集成测试
 * 覆盖端点：GET /api/health
 * 场景：存活检查、无需认证
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

describe('HealthController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('health_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/health', () => {
    it('AC-01: returns 200 with status info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.status).toBe('ok')
      expect(body.data.timestamp).toBeDefined()
      expect(new Date(body.data.timestamp).toISOString()).toBe(body.data.timestamp)
      expect(body.data.version).toBeDefined()
    })

    it('AC-02: does not require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      })
      expect(res.statusCode).toBe(200)
      // HealthController 无 @UseGuards(JwtAuthGuard)，应直接访问
      expect(res.json().data.status).toBe('ok')
    })
  })
})
