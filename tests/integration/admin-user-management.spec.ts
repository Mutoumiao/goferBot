import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

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
