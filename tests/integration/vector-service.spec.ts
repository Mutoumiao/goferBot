import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { VectorService } from '../../packages/server/src/processors/vector/vector.service'

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
  })
})
