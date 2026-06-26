import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelProviderService } from '@/modules/settings/model-provider.service.js'
import type { SystemConfigService } from '@/modules/settings/system-config.service.js'
import type { SearchHit } from '@/processors/rag/elasticsearch.service.js'
import type { RetrievedChunk } from '@/processors/rag/llamaindex-rag.service.js'
import { LlamaIndexRagService } from '@/processors/rag/llamaindex-rag.service.js'

const makeHit = (
  id: string,
  content: string,
  score: number,
  opts: { parent_id?: string; parent_content?: string } = {},
): SearchHit => ({
  id,
  score,
  source: {
    id,
    document_id: `doc-${id}`,
    kb_id: 'kb-1',
    content,
    chunk_index: 0,
    token_count: 10,
    embedding: new Array(1536).fill(0),
    parent_id: opts.parent_id,
    parent_content: opts.parent_content,
  },
})

async function createService(overrides: Record<string, any> = {}): Promise<LlamaIndexRagService> {
  const embeddings = {
    embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    embedBatch: vi.fn().mockResolvedValue([]),
    getDimensions: vi.fn().mockReturnValue(1536),
    ...overrides.embeddings,
  }
  const es = {
    bulkIndex: vi.fn().mockResolvedValue(undefined),
    deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
    getParentsByIds: vi.fn().mockResolvedValue(new Map()),
    ...overrides.es,
  }
  const keywordService = {
    search: vi.fn().mockResolvedValue([]),
    ...overrides.keywordService,
  }
  const vectorService = {
    search: vi.fn().mockResolvedValue([]),
    ...overrides.vectorService,
  }
  const reranker = {
    rerank: vi.fn().mockImplementation(async (_q: string, candidates: any[], opts: any = {}) => {
      const topK: number = opts.topK ?? candidates.length
      return candidates.slice(0, topK).map((c: any, i: number) => ({
        id: c.id,
        content: c.content,
        metadata: c.metadata,
        originalScore: c.originalScore,
        score: (c.originalScore ?? 0) - i * 0.1,
      }))
    }),
    ...overrides.reranker,
  }
  const groundingService = {
    checkGrounding: vi.fn().mockResolvedValue([]),
    ...overrides.groundingService,
  }
  const guardrailService = {
    apply: vi.fn().mockReturnValue({
      safe: true,
      filteredText: '',
      redactions: [],
      warnings: [],
    }),
    ...overrides.guardrailService,
  }
  const routerService = {
    decide: vi.fn().mockReturnValue({
      intent: 'general' as const,
      pipeline: {
        mode: 'hybrid' as const,
        vectorWeight: 0.7,
        bm25Weight: 0.3,
        needRerank: true,
        needFullContext: true,
        topK: 5,
        candidateK: 60,
      },
    }),
    ...overrides.routerService,
  }
  const queryUnderstanding = {
    process: vi.fn().mockResolvedValue({
      rewrittenQuery: 'hello',
      language: 'en' as const,
      expandedQueries: ['hello'],
    }),
    ...overrides.queryUnderstanding,
  }
  const prisma = {
    knowledgeBase: {
      count: vi.fn().mockResolvedValue(1),
      ...(overrides.prisma?.knowledgeBase ?? {}),
    },
    ...overrides.prisma,
  }

  const systemConfigService = {
    getDecryptedSystemConfig: vi.fn().mockResolvedValue({
      providers: {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          type: 'llm',
          enabled: true,
          apiKey: 'key',
          model: 'gpt-4o',
          baseUrl: '',
          timeoutMs: 300_000,
        },
        openaiEmbedding: {
          id: 'openaiEmbedding',
          name: 'OpenAI Embedding',
          type: 'embedding',
          enabled: true,
          apiKey: 'key',
          model: 'text-embedding-3-small',
          baseUrl: '',
          timeoutMs: 300_000,
          dimensions: 1536,
        },
        reranker: {
          id: 'reranker',
          name: 'BGE Reranker',
          type: 'reranker',
          enabled: true,
          apiKey: '',
          model: 'BAAI/bge-reranker-v2-m3',
          baseUrl: '',
          timeoutMs: 60_000,
          maxLength: 512,
        },
      },
      chat: { defaultProvider: 'openai', enabledProviders: ['openai'], temperature: 0.7 },
      rag: {
        llmProvider: 'openai',
        embeddingProvider: 'openaiEmbedding',
        rerankerProvider: 'reranker',
        timeoutMs: 60_000,
        rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
      },
      companion: { provider: 'openai' },
      indexing: {
        contextualEmbedding: true,
        contextualWindow: 1,
        parentChunkSize: 800,
        childChunkSize: 150,
        synonymDict: { zh: {}, en: {} },
      },
      appearance: { mode: 'light', fontSizeLevel: 3 },
    }),
    ...overrides.systemConfigService,
  }

  const modelProviderService = {
    resolveProvider: vi.fn().mockImplementation((_path: string, type: string, config: any) => {
      if (type === 'llm') return config.providers.openai
      if (type === 'embedding') return config.providers.openaiEmbedding
      if (type === 'reranker') return config.providers.reranker
      return undefined
    }),
    ...overrides.modelProviderService,
  }

  const service = new LlamaIndexRagService(
    embeddings as any,
    es as any,
    keywordService as any,
    vectorService as any,
    reranker as any,
    groundingService as any,
    guardrailService as any,
    routerService as any,
    queryUnderstanding as any,
    prisma as any,
    systemConfigService as unknown as SystemConfigService,
    modelProviderService as unknown as ModelProviderService,
  )
  await service.onModuleInit()
  return service
}

describe('LlamaIndexRagService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('retrieve', () => {
    it('vector mode: calls embed then vectorService.search', async () => {
      const vs = { search: vi.fn().mockResolvedValue([makeHit('h1', 'hello world', 0.9)]) }
      const service = await createService({ vectorService: vs })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1'],
        mode: 'vector',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(vs.search).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('hello world')
    })

    it('bm25 mode: calls keywordService.search', async () => {
      const ks = { search: vi.fn().mockResolvedValue([makeHit('h2', 'bm25 match', 0.8)]) }
      const service = await createService({ keywordService: ks })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1'],
        mode: 'bm25',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(ks.search).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('bm25 match')
    })

    it('hybrid mode: calls both services and applies RRF', async () => {
      const vs = { search: vi.fn().mockResolvedValue([makeHit('h1', 'vector hit', 0.9)]) }
      const ks = { search: vi.fn().mockResolvedValue([makeHit('h2', 'bm25 hit', 0.9)]) }
      const service = await createService({
        vectorService: vs,
        keywordService: ks,
      })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1'],
        mode: 'hybrid',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(vs.search).toHaveBeenCalledOnce()
      expect(ks.search).toHaveBeenCalledOnce()
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('empty query still executes retrieval flow', async () => {
      const vs = { search: vi.fn().mockResolvedValue([]) }
      const service = await createService({ vectorService: vs })
      const result = await service.retrieve('', {
        kbIds: ['kb-1'],
        mode: 'vector',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('returns empty when ACL kbIds is empty', async () => {
      const service = await createService()
      const vs = { search: vi.fn() }
      ;(service as any).vectorService = vs
      const result = await service.retrieve('hello', { kbIds: [] })
      expect(result).toEqual([])
      expect(vs.search).not.toHaveBeenCalled()
    })

    it('runs rerank when needRerank is true', async () => {
      const hits = [makeHit('h1', 'first document', 0.5), makeHit('h2', 'second document', 0.4)]
      const vs = { search: vi.fn().mockResolvedValue(hits) }
      const rerank = {
        rerank: vi
          .fn()
          .mockImplementation(async (_q: string, candidates: any[]) =>
            candidates.map((c: any, i: number) => ({ ...c, score: 1 - i * 0.25 })),
          ),
      }
      const service = await createService({ vectorService: vs, reranker: rerank })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1'],
        mode: 'vector',
        topK: 5,
        needRerank: true,
        resolveParents: false,
      })
      expect(rerank.rerank).toHaveBeenCalledOnce()
      expect(result[0].score).toBeGreaterThanOrEqual(result[result.length - 1].score)
    })

    it('returns structured chunks with expected shape', async () => {
      const vs = { search: vi.fn().mockResolvedValue([makeHit('h1', 'content body', 0.9)]) }
      const service = await createService({ vectorService: vs })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1'],
        userId: 'user-1',
        mode: 'vector',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('documentId')
      expect(result[0]).toHaveProperty('kbId')
      expect(result[0]).toHaveProperty('content')
      expect(result[0]).toHaveProperty('score')
      expect(result[0]).toHaveProperty('chunkIndex')
    })
  })

  describe('buildContext', () => {
    it('returns empty string for empty input', async () => {
      const service = await createService()
      const result = await service.buildContext([])
      expect(result).toBe('')
    })

    it('numbers and joins chunks', async () => {
      const service = await createService()
      const chunks: RetrievedChunk[] = [
        { id: 'a', documentId: 'd1', kbId: 'k1', content: 'first', chunkIndex: 0, score: 0.9 },
        { id: 'b', documentId: 'd2', kbId: 'k1', content: 'second', chunkIndex: 1, score: 0.8 },
      ]
      const result = await service.buildContext(chunks)
      expect(result).toBe('[1] first\n\n[2] second')
    })

    it('deduplicates chunks by documentId', async () => {
      const service = await createService()
      const chunks: RetrievedChunk[] = [
        { id: 'a', documentId: 'd1', kbId: 'k1', content: 'dup-a', chunkIndex: 0, score: 0.9 },
        { id: 'b', documentId: 'd1', kbId: 'k1', content: 'dup-b', chunkIndex: 1, score: 0.85 },
        { id: 'c', documentId: 'd2', kbId: 'k1', content: 'unique', chunkIndex: 2, score: 0.7 },
      ]
      const result = await service.buildContext(chunks)
      const idsInOutput = result.match(/\[\d+\]/g) ?? []
      expect(idsInOutput.length).toBe(2)
      expect(result).toContain('dup-a')
      expect(result).toContain('unique')
    })

    it('truncates chunks when exceeding token budget', async () => {
      const service = await createService()
      const chunks: RetrievedChunk[] = [
        {
          id: 'a',
          documentId: 'd1',
          kbId: 'k1',
          content: 'x'.repeat(4000),
          chunkIndex: 0,
          score: 0.9,
        },
      ]
      const result = await service.buildContext(chunks, 50)
      expect(result.endsWith('...')).toBe(true)
    })
  })

  describe('ACL + QueryUnderstanding integration', () => {
    it('runs queryUnderstanding.process before retrieval', async () => {
      const qu = {
        process: vi.fn().mockResolvedValue({
          rewrittenQuery: 'rewritten hello',
          language: 'en' as const,
          expandedQueries: ['rewritten hello'],
        }),
      }
      const vs = { search: vi.fn().mockResolvedValue([]) }
      const service = await createService({ queryUnderstanding: qu, vectorService: vs })
      await service.retrieve('hello', {
        kbIds: ['kb-1'],
        userId: 'user-1',
        mode: 'vector',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(qu.process).toHaveBeenCalledWith('hello')
      expect(vs.search).toHaveBeenCalled()
    })

    it('throws ForbiddenException when user does not own kbId', async () => {
      const prisma = {
        knowledgeBase: { count: vi.fn().mockResolvedValue(0) },
      }
      const vs = { search: vi.fn() }
      const service = await createService({ prisma, vectorService: vs })
      await expect(
        service.retrieve('hello', {
          kbIds: ['kb-1'],
          userId: 'user-1',
          mode: 'vector',
          needRerank: false,
          resolveParents: false,
        }),
      ).rejects.toThrow('无权访问指定的知识库')
      expect(vs.search).not.toHaveBeenCalled()
    })

    it('allows access when user owns all kbIds', async () => {
      const prisma = {
        knowledgeBase: { count: vi.fn().mockResolvedValue(2) },
      }
      const vs = { search: vi.fn().mockResolvedValue([makeHit('h1', 'ok', 0.9)]) }
      const service = await createService({ prisma, vectorService: vs })
      const result = await service.retrieve('hello', {
        kbIds: ['kb-1', 'kb-2'],
        userId: 'user-1',
        mode: 'vector',
        topK: 5,
        needRerank: false,
        resolveParents: false,
      })
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('does not run ownership check when userId is absent', async () => {
      const prisma = { knowledgeBase: { count: vi.fn() } }
      const vs = { search: vi.fn().mockResolvedValue([]) }
      const service = await createService({ prisma, vectorService: vs })
      await service.retrieve('hello', {
        kbIds: ['kb-1'],
        mode: 'vector',
        needRerank: false,
        resolveParents: false,
      })
      expect(prisma.knowledgeBase.count).not.toHaveBeenCalled()
    })
  })

  describe('indexDocument upsert', () => {
    it('deletes existing chunks before indexing', async () => {
      const es = {
        bulkIndex: vi.fn().mockResolvedValue(undefined),
        deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
      }
      const embeddings = {
        embedBatch: vi.fn().mockResolvedValue(new Array(5).fill(new Array(1536).fill(0.1))),
      }
      const service = await createService({ es, embeddings })
      await service.indexDocument('doc-1', 'kb-1', 'hello world content for test')
      expect(es.deleteByDocumentId).toHaveBeenCalledWith('doc-1')
      const deleteOrder = es.deleteByDocumentId.mock.invocationCallOrder[0]
      const bulkOrder = es.bulkIndex.mock.invocationCallOrder[0]
      expect(deleteOrder).toBeLessThan(bulkOrder)
    })

    it('throws ForbiddenException when user does not own the target kb', async () => {
      const prisma = { knowledgeBase: { count: vi.fn().mockResolvedValue(0) } }
      const service = await createService({ prisma })
      await expect(
        service.indexDocument('doc-1', 'kb-1', 'hello', undefined, undefined, undefined, {
          userId: 'user-2',
        }),
      ).rejects.toThrow()
    })

    it('allows indexing when user owns the target kb', async () => {
      const prisma = { knowledgeBase: { count: vi.fn().mockResolvedValue(1) } }
      const es = {
        bulkIndex: vi.fn().mockResolvedValue(undefined),
        deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
      }
      const embeddings = {
        embedBatch: vi.fn().mockResolvedValue(new Array(2).fill(new Array(1536).fill(0.1))),
      }
      const service = await createService({ prisma, es, embeddings })
      await expect(
        service.indexDocument(
          'doc-1',
          'kb-1',
          'hello world content for test',
          undefined,
          undefined,
          undefined,
          { userId: 'user-1' },
        ),
      ).resolves.not.toThrow()
    })
  })

  describe('splitIntoChunks', () => {
    it('returns empty array for empty string', async () => {
      const service = await createService()
      const split = (service as any).splitIntoChunks as (
        t: string,
        c: number,
        o: number,
      ) => string[]
      expect(split('', 100, 10)).toEqual([])
    })

    it('splits by paragraph boundaries', async () => {
      const service = await createService()
      const split = (service as any).splitIntoChunks as (
        t: string,
        c: number,
        o: number,
      ) => string[]
      const text = 'aaa\nbbb\n\nccc\nddd\n\nEEE'
      const result = split(text, 20, 5)
      expect(result.length).toBeGreaterThan(0)
      expect(result.every((c) => c.length <= 20)).toBe(true)
    })

    it('splits long paragraphs by chunkSize', async () => {
      const service = await createService()
      const split = (service as any).splitIntoChunks as (
        t: string,
        c: number,
        o: number,
      ) => string[]
      const long = 'x'.repeat(100)
      const result = split(long, 30, 5)
      expect(result.length).toBeGreaterThan(1)
      expect(result.every((c) => c.trim().length > 0)).toBe(true)
    })

    it('respects chunk size', async () => {
      const service = await createService()
      const split = (service as any).splitIntoChunks as (
        t: string,
        c: number,
        o: number,
      ) => string[]
      const text = 'short'
      const result = split(text, 100, 10)
      expect(result).toEqual(['short'])
    })
  })

  describe('removeDocument', () => {
    it('calls es.deleteByDocumentId when no userId is supplied (backward compat)', async () => {
      const es = {
        deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
        getKbIdsByDocumentId: vi.fn().mockResolvedValue([]),
      }
      const service = await createService({ es })
      await service.removeDocument('doc-1')
      expect(es.deleteByDocumentId).toHaveBeenCalledWith('doc-1')
      expect(es.deleteByDocumentId).toHaveBeenCalledTimes(1)
    })

    it('throws ForbiddenException when user does not own the document', async () => {
      const es = { getKbIdsByDocumentId: vi.fn().mockResolvedValue(['kb-1']) }
      const prisma = { knowledgeBase: { count: vi.fn().mockResolvedValue(0) } }
      const service = await createService({ es, prisma })
      await expect(service.removeDocument('doc-1', 'user-2')).rejects.toThrow()
    })

    it('calls delete when user owns the underlying kb', async () => {
      const es = {
        getKbIdsByDocumentId: vi.fn().mockResolvedValue(['kb-1']),
        deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
      }
      const prisma = { knowledgeBase: { count: vi.fn().mockResolvedValue(1) } }
      const service = await createService({ es, prisma })
      await service.removeDocument('doc-1', 'user-1')
      expect(es.deleteByDocumentId).toHaveBeenCalledWith('doc-1')
    })
  })
})
