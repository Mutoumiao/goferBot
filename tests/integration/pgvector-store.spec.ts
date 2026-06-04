import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PgVectorStore } from '../../packages/server/src/vector/pgvector'
import { VectorStoreError } from '../../packages/server/src/interfaces/errors'
import { checkInfrastructure } from './helpers/infra-check.js'

describe('PgVectorStore', () => {
  let prisma: PrismaClient
  let store: PgVectorStore
  let infraAvailable = false

  beforeAll(async () => {
    const infraResult = await checkInfrastructure()
    infraAvailable = infraResult.allAvailable
    if (!infraAvailable) {
      console.log('[PgVectorStore] 基础设施不可用，跳过')
      return
    }
    prisma = new PrismaClient()
    store = new PgVectorStore(prisma as any)
    await store.ensureCollection()
  })

  afterAll(async () => {
    if (prisma) await prisma.$disconnect()
  })

  beforeEach(async () => {
    if (!infraAvailable) return
  })

  it('AC-01: implements IVectorStore interface', () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    expect(store.ensureCollection).toBeDefined()
    expect(store.insertVectors).toBeDefined()
    expect(store.searchVectors).toBeDefined()
    expect(store.deleteByIds).toBeDefined()
  })

  it('AC-02: insertVectors is deprecated, use PrismaVectorIndexer.index instead', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    // ADR 0001 决策：向量插入由 PrismaVectorIndexer 处理（单事务写入元数据+向量）
    // PgVectorStore.insertVectors 已废弃并抛错
    const record = {
      id: crypto.randomUUID(),
      chunkId: crypto.randomUUID(),
      kbId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      embedding: new Array(1536).fill(0.1),
    }

    await expect(store.insertVectors([record])).rejects.toThrow(VectorStoreError)
    await expect(store.insertVectors([record])).rejects.toThrow('已废弃')
  })

  it('AC-03: searchVectors returns results ordered by similarity', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const kbId = crypto.randomUUID()
    const docId = crypto.randomUUID()
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]

    // 使用 $executeRaw 插入测试数据（Prisma Client 不支持 Unsupported 类型字段的 create）
    for (let i = 0; i < ids.length; i++) {
      const embedding = [new Array(1536).fill(0.1), new Array(1536).fill(0.2), new Array(1536).fill(0.3)][i]
      await prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, kb_id, content, chunk_index, embedding)
        VALUES (${ids[i]}::uuid, ${docId}::uuid, ${kbId}::uuid, ${'chunk ' + i}, ${i}, ${embedding}::vector)
      `
    }

    // 搜索最接近 0.2 的向量
    const results = await store.searchVectors(new Array(1536).fill(0.2), {
      topK: 3,
      filter: { kbId },
    })

    expect(results.length).toBe(3)
    expect(results[0].chunkId).toBe(ids[1]) // 0.2 最接近 0.2
    expect(results[0].score).toBeGreaterThan(0.9)

    // 清理
    await store.deleteByIds(ids)
  })

  it('AC-04: deleteByIds removes records', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    const id = crypto.randomUUID()
    const docId = crypto.randomUUID()
    const kbId = crypto.randomUUID()

    // 使用 $executeRaw 插入测试数据（Prisma Client 不支持 Unsupported 类型字段的 create）
    await prisma.$executeRaw`
      INSERT INTO chunks (id, document_id, kb_id, content, chunk_index, embedding)
      VALUES (${id}::uuid, ${docId}::uuid, ${kbId}::uuid, ${'test content'}, ${0}, ${new Array(1536).fill(0.1)}::vector)
    `

    await store.deleteByIds([id])

    const result = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM chunks WHERE id = ${id}::uuid
    `
    expect(result[0].count).toBe(0)
  })

  it('AC-05: ensureCollection is idempotent', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    await expect(store.ensureCollection()).resolves.not.toThrow()
    await expect(store.ensureCollection()).resolves.not.toThrow()
  })

  it('AC-06: insertVectors rejects empty array', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    await expect(store.insertVectors([])).rejects.toThrow(VectorStoreError)
  })

  it('AC-07: insertVectors rejects wrong dimension', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    await expect(store.insertVectors([{
      id: crypto.randomUUID(),
      chunkId: crypto.randomUUID(),
      kbId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      embedding: new Array(100).fill(0.1),
    }])).rejects.toThrow(VectorStoreError)
  })

  it('AC-08: searchVectors rejects wrong dimension', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    await expect(store.searchVectors(new Array(100).fill(0.1))).rejects.toThrow(VectorStoreError)
  })

  it('AC-09: deleteByIds rejects empty array', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    await expect(store.deleteByIds([])).rejects.toThrow(VectorStoreError)
  })
})
