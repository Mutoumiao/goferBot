import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaService } from '../../packages/server/src/processors/database/prisma.service.js'

export let app: NestFastifyApplication
export let prisma: PrismaClient
export const mockEmbeddingPort = 9999
export const mockLLMPort = 9998

let dbManager: TestDatabaseManager | null = null
let dbName: string | null = null

export async function setupE2E(): Promise<void> {
  dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('rag_e2e')
  dbName = new URL(dbUrl).pathname.slice(1)

  app = await TestAppFactory.create(dbUrl, { realMode: true })
  prisma = app.get(PrismaService)
}

export async function teardownE2E(): Promise<void> {
  if (app) {
    await app.close()
    app = null as any
  }
  if (dbManager && dbName) {
    await dbManager.dropDatabase(dbName)
    dbManager = null
    dbName = null
  }
  if (prisma) {
    await prisma.$disconnect()
    prisma = null as any
  }
}
