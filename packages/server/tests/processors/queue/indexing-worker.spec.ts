import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IndexingWorker } from '@/processors/queue/indexing.worker.js'

describe('IndexingWorker', () => {
  let worker: IndexingWorker
  let mockPrisma: any
  let mockStorage: any
  let mockParser: any
  let mockKnowledgeAi: any
  let mockProviderResolver: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      knowledgeBase: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }
    mockStorage = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('test content')),
    }
    mockParser = {
      parse: vi.fn().mockResolvedValue({
        content: 'test content',
        title: 'Doc',
        sections: [],
        hierarchyPath: [],
        metadata: {},
      }),
    }
    mockKnowledgeAi = {
      index: vi.fn().mockResolvedValue({
        document_id: 'd1',
        kb_id: 'kb1',
        chunk_count: 10,
        status: 'ok',
      }),
    }
    mockProviderResolver = {
      resolveEmbeddingConfig: vi.fn().mockResolvedValue({
        embedding_model: 'text-embedding-3-small',
        embedding_api_key: 'key',
        embedding_base_url: 'https://api.example.com',
      }),
    }
    worker = new IndexingWorker(
      mockPrisma,
      mockStorage,
      mockParser,
      mockKnowledgeAi,
      mockProviderResolver,
    )
  })

  it('AC-02: handleIndexJob calls Knowledge AI /index and sets status to ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      name: 'a.txt',
      storageKey: 'k1',
      mimeType: 'text/plain',
      status: 'uploaded',
    })
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', userId: 'user1' })

    await worker.handleIndexJob({ id: 'job-1', data: { documentId: 'd1', type: 'index' } } as any)

    expect(mockProviderResolver.resolveEmbeddingConfig).toHaveBeenCalledWith('user1')
    expect(mockKnowledgeAi.index).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'd1',
        kb_id: 'kb1',
        text: 'test content',
        metadata: expect.objectContaining({
          source_mime: 'text/plain',
          name: 'a.txt',
        }),
        _provider: expect.objectContaining({
          embedding_model: 'text-embedding-3-small',
        }),
      }),
    )
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'ready', errorMessage: null }),
      }),
    )
  })

  it('AC-03: stage changes map to indexing then ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      name: 'a.txt',
      storageKey: 'k1',
      mimeType: 'text/plain',
      status: 'uploaded',
    })
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', userId: 'user1' })
    const statusUpdates: string[] = []
    mockPrisma.document.update.mockImplementation(({ data }: any) => {
      statusUpdates.push(data.status)
      return Promise.resolve({})
    })

    await worker.handleIndexJob({ id: 'job-1', data: { documentId: 'd1', type: 'index' } } as any)
    expect(statusUpdates).toEqual(['indexing', 'ready'])
  })

  it('AC-04: handleIndexJob throws when document not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)
    await expect(
      worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any),
    ).rejects.toThrow('Document not found')
  })

  it('AC-05: Knowledge AI index failure sets status to failed', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      name: 'a.txt',
      storageKey: 'k1',
      mimeType: 'text/plain',
      status: 'uploaded',
    })
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', userId: 'user1' })
    mockKnowledgeAi.index.mockRejectedValue(new Error('Knowledge AI /index failed: 503'))

    await expect(
      worker.handleIndexJob({ id: 'job-1', data: { documentId: 'd1', type: 'index' } } as any),
    ).rejects.toThrow('Knowledge AI /index failed: 503')

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('Knowledge AI /index failed: 503'),
        }),
      }),
    )
  })

  it('AC-06: missing owner cannot resolve embedding provider', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      name: 'a.txt',
      storageKey: 'k1',
      mimeType: 'text/plain',
    })
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', userId: null })

    await expect(
      worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any),
    ).rejects.toThrow(/no owner/)
  })
})
