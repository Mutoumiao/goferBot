import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PgVectorStore } from '../../../packages/server/src/vector/pgvector'
import { VectorStoreError } from '../../../packages/server/src/interfaces/errors'

describe('PgVectorStore', () => {
  let prisma: PrismaClient
  let store: PgVectorStore

  beforeAll(async () => {
    prisma = new PrismaClient()
    store = new PgVectorStore(prisma as any)
    await store.ensureCollection()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('AC-01: implements IVectorStore interface', () => {
    expect(store.ensureCollection).toBeDefined()
    expect(store.insertVectors).toBeDefined()
    expect(store.searchVectors).toBeDefined()
    expect(store.deleteByIds).toBeDefined()
  })

  it('AC-02: insertVectors writes to chunks.embedding', async () => {
    const id = crypto.randomUUID()
    const record = {
      id,
      chunkId: id,
      kbId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      embedding: new Array(1536).fill(0.1),
    }

    await store.insertVectors([record])

    const result = await prisma.$queryRaw<{ embedding: string }[]>`
      SELECT embedding::text FROM chunks WHERE id = ${id}::uuid
    `
    expect(result.length).toBe(1)
    expect(result[0].embedding).toContain('0.1')

    // 清理
    await store.deleteByIds([id])
  })

  it('AC-03: searchVectors returns results ordered by similarity', async () => {
    const kbId = crypto.randomUUID()
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]

    // 插入 3 个不同向量
    await store.insertVectors([
      { id: ids[0], chunkId: ids[0], kbId, fileId: crypto.randomUUID(), embedding: new Array(1536).fill(0.1) },
      { id: ids[1], chunkId: ids[1], kbId, fileId: crypto.randomUUID(), embedding: new Array(1536).fill(0.2) },
      { id: ids[2], chunkId: ids[2], kbId, fileId: crypto.randomUUID(), embedding: new Array(1536).fill(0.3) },
    ])

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
    const id = crypto.randomUUID()
    await store.insertVectors([{
      id,
      chunkId: id,
      kbId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      embedding: new Array(1536).fill(0.1),
    }])

    await store.deleteByIds([id])

    const result = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM chunks WHERE id = ${id}::uuid
    `
    expect(result[0].count).toBe(0)
  })

  it('AC-05: ensureCollection is idempotent', async () => {
    await expect(store.ensureCollection()).resolves.not.toThrow()
    await expect(store.ensureCollection()).resolves.not.toThrow()
  })

  it('AC-06: insertVectors rejects empty array', async () => {
    await expect(store.insertVectors([])).rejects.toThrow(VectorStoreError)
  })

  it('AC-07: insertVectors rejects wrong dimension', async () => {
    await expect(store.insertVectors([{
      id: crypto.randomUUID(),
      chunkId: crypto.randomUUID(),
      kbId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      embedding: new Array(100).fill(0.1),
    }])).rejects.toThrow(VectorStoreError)
  })

  it('AC-08: searchVectors rejects wrong dimension', async () => {
    await expect(store.searchVectors(new Array(100).fill(0.1))).rejects.toThrow(VectorStoreError)
  })

  it('AC-09: deleteByIds rejects empty array', async () => {
    await expect(store.deleteByIds([])).rejects.toThrow(VectorStoreError)
  })
})
