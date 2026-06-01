import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service'

describe('VectorService', () => {
  let prisma: PrismaClient
  let service: VectorService

  beforeAll(async () => {
    prisma = new PrismaClient()
    service = new VectorService(prisma as any)
    await service.onModuleInit()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('AC-05: uses PgVectorStore', () => {
    expect(service).toBeDefined()
    expect(service.ensureCollection).toBeDefined()
    expect(service.insertVectors).toBeDefined()
    expect(service.searchVectors).toBeDefined()
    expect(service.deleteByIds).toBeDefined()
    // deleteByFileId / deleteByKbId 已移除
    expect((service as any).deleteByFileId).toBeUndefined()
    expect((service as any).deleteByKbId).toBeUndefined()
  })

  it('AC-06: delegates to PgVectorStore for search', async () => {
    const kbId = crypto.randomUUID()
    const id = crypto.randomUUID()

    // 插入测试数据
    await service.insertVectors([{
      id,
      chunkId: id,
      kbId,
      fileId: crypto.randomUUID(),
      embedding: new Array(1536).fill(0.1),
    }])

    // 搜索
    const results = await service.searchVectors(new Array(1536).fill(0.1), {
      topK: 1,
      filter: { kbId },
    })

    expect(results.length).toBe(1)
    expect(results[0].chunkId).toBe(id)

    // 清理
    await service.deleteByIds([id])
  })
})
