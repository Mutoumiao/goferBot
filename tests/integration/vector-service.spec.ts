// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { VectorService } from '../../packages/server/src/processors/vector/vector.service'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { checkInfrastructure } from './helpers/infra-check.js'

describe('VectorService', () => {
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[VectorService] 基础设施不可用，跳过')
    }
  })

  it('AC-05: uses PgVectorStore', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const dbManager = new TestDatabaseManager()
    const dbUrl = await dbManager.createDatabase('vector_service')
    const dbName = new URL(dbUrl).pathname.slice(1)
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
    const service = new VectorService(prisma as any)
    await service.onModuleInit()

    try {
      expect(service).toBeDefined()
      expect(service.ensureCollection).toBeDefined()
      expect(service.insertVectors).toBeDefined()
      expect(service.searchVectors).toBeDefined()
      expect(service.deleteByIds).toBeDefined()
      // deleteByFileId / deleteByKbId 已移除
      expect((service as any).deleteByFileId).toBeUndefined()
      expect((service as any).deleteByKbId).toBeUndefined()
    } finally {
      await prisma.$disconnect()
      await dbManager.dropDatabase(dbName)
    }
  })

  it('AC-06: delegates to PgVectorStore for search', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }

    const dbManager = new TestDatabaseManager()
    const dbUrl = await dbManager.createDatabase('vector_service')
    const dbName = new URL(dbUrl).pathname.slice(1)
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
    const service = new VectorService(prisma as any)
    await service.onModuleInit()

    try {
      const kbId = crypto.randomUUID()
      const id = crypto.randomUUID()

      // 使用 $executeRaw 插入测试数据（Prisma Client 不支持 Unsupported 类型字段的 create）
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, kb_id, content, chunk_index, embedding)
        VALUES (${id}::uuid, ${crypto.randomUUID()}::uuid, ${kbId}::uuid, ${'test content'}, ${0}, ${new Array(1536).fill(0.1)}::vector)
      `

      // 搜索
      const results = await service.searchVectors(new Array(1536).fill(0.1), {
        topK: 1,
        filter: { kbId },
      })

      expect(results.length).toBe(1)
      expect(results[0].chunkId).toBe(id)

      // 清理
      await service.deleteByIds([id])
    } finally {
      await prisma.$disconnect()
      await dbManager.dropDatabase(dbName)
    }
  })
})
