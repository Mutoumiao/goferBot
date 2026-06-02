import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaVectorIndexer } from '../../packages/server/src/processors/indexing/prisma-vector.indexer'
import { ValidationError } from '@goferbot/rag-sdk'

describe('PrismaVectorIndexer', () => {
  let prisma: PrismaClient
  let indexer: PrismaVectorIndexer

  beforeAll(async () => {
    prisma = new PrismaClient()
    indexer = new PrismaVectorIndexer(prisma as any)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('AC-01: implements IIndexer interface', () => {
    expect(indexer.index).toBeDefined()
  })

  it('AC-02: single transaction writes chunks and embeddings', async () => {
    const docId = crypto.randomUUID()
    const kbId = crypto.randomUUID()
    const chunks = [
      {
        id: crypto.randomUUID(),
        documentId: docId,
        kbId,
        content: 'Hello world',
        chunkIndex: 0,
        tokenCount: 2,
      },
      {
        id: crypto.randomUUID(),
        documentId: docId,
        kbId,
        content: 'Second chunk',
        chunkIndex: 1,
        tokenCount: 2,
      },
    ]
    const vectors = [
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
    ]

    await indexer.index(chunks as any, vectors)

    // 验证 chunks 表中有数据
    const result = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM chunks WHERE document_id = ${docId}::uuid
    `
    expect(result[0].count).toBe(2)

    // 验证 embedding 列有数据
    const embeddings = await prisma.$queryRaw<{ embedding: string }[]>`
      SELECT embedding::text FROM chunks WHERE document_id = ${docId}::uuid ORDER BY chunk_index
    `
    expect(embeddings.length).toBe(2)
    expect(embeddings[0].embedding).toContain('0.1')
    expect(embeddings[1].embedding).toContain('0.2')

    // 清理
    await prisma.$executeRaw`DELETE FROM chunks WHERE document_id = ${docId}::uuid`
  })

  it('AC-03: uses exact tokenCount from usage', async () => {
    const docId = crypto.randomUUID()
    const kbId = crypto.randomUUID()
    const chunks = [
      {
        id: crypto.randomUUID(),
        documentId: docId,
        kbId,
        content: 'Hello world',
        chunkIndex: 0,
      },
    ]
    const vectors = [new Array(1536).fill(0.1)]
    const usage = [{ promptTokens: 42, totalTokens: 42 }]

    await indexer.index(chunks as any, vectors, usage as any)

    const result = await prisma.$queryRaw<{ token_count: number }[]>`
      SELECT token_count FROM chunks WHERE id = ${chunks[0].id}::uuid
    `
    expect(result[0].token_count).toBe(42)

    // 清理
    await prisma.$executeRaw`DELETE FROM chunks WHERE id = ${chunks[0].id}::uuid`
  })

  it('AC-04: falls back to estimated tokenCount', async () => {
    const docId = crypto.randomUUID()
    const kbId = crypto.randomUUID()
    const chunks = [
      {
        id: crypto.randomUUID(),
        documentId: docId,
        kbId,
        content: 'Hello world', // 11 chars -> ceil(11/4) = 3
        chunkIndex: 0,
      },
    ]
    const vectors = [new Array(1536).fill(0.1)]

    await indexer.index(chunks as any, vectors)

    const result = await prisma.$queryRaw<{ token_count: number }[]>`
      SELECT token_count FROM chunks WHERE id = ${chunks[0].id}::uuid
    `
    expect(result[0].token_count).toBe(3)

    // 清理
    await prisma.$executeRaw`DELETE FROM chunks WHERE id = ${chunks[0].id}::uuid`
  })

  it('AC-05: ON CONFLICT handles retry', async () => {
    const docId = crypto.randomUUID()
    const kbId = crypto.randomUUID()
    const chunkId = crypto.randomUUID()
    const chunks = [
      {
        id: chunkId,
        documentId: docId,
        kbId,
        content: 'Original content',
        chunkIndex: 0,
      },
    ]
    const vectors = [new Array(1536).fill(0.1)]

    // 第一次插入
    await indexer.index(chunks as any, vectors)

    // 修改内容后再次插入（模拟重试）
    const updatedChunks = [
      {
        ...chunks[0],
        content: 'Updated content',
      },
    ]
    const updatedVectors = [new Array(1536).fill(0.2)]

    // 不应报错
    await expect(indexer.index(updatedChunks as any, updatedVectors)).resolves.not.toThrow()

    // 验证内容已更新
    const result = await prisma.$queryRaw<{ content: string; embedding: string }[]>`
      SELECT content, embedding::text FROM chunks WHERE id = ${chunkId}::uuid
    `
    expect(result[0].content).toBe('Updated content')
    expect(result[0].embedding).toContain('0.2')

    // 清理
    await prisma.$executeRaw`DELETE FROM chunks WHERE id = ${chunkId}::uuid`
  })

  it('AC-06: does not depend on VectorService', () => {
    // PrismaVectorIndexer 构造函数只接受 PrismaService
    // 通过检查实例属性验证
    expect((indexer as any).prisma).toBeDefined()
    expect((indexer as any).vectorService).toBeUndefined()
  })

  it('AC-07: empty chunks returns without error', async () => {
    await expect(indexer.index([], [])).resolves.not.toThrow()
  })

  it('AC-08: rejects mismatched chunks and vectors', async () => {
    await expect(
      indexer.index([{ id: '1' } as any], [])
    ).rejects.toThrow(ValidationError)
  })
})
