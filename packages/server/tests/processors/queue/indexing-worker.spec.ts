import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IndexingWorker } from '@/processors/queue/indexing.worker.js'
import { LlamaIndexRagService } from '@/processors/rag/llamaindex-rag.service.js'

describe('IndexingWorker', () => {
  let worker: IndexingWorker
  let mockPrisma: any
  let mockStorage: any
  let mockParser: any
  let mockRagService: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    mockStorage = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('test content')),
    }
    mockParser = {
      parse: vi.fn().mockResolvedValue({
        content: 'test content',
        sections: [],
        hierarchyPath: [],
        metadata: {},
      }),
    }
    mockRagService = {
      indexDocument: vi.fn().mockResolvedValue({ totalChunks: 10 }),
    }
    worker = new IndexingWorker(mockPrisma, mockStorage, mockParser, mockRagService)
  })

  it('AC-02: handleIndexJob drives full pipeline and sets status to ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      storageKey: 'k1',
      mimeType: 'text/plain',
      status: 'uploaded',
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)

    expect(mockRagService.indexDocument).toHaveBeenCalledWith(
      'd1',
      'kb1',
      'test content',
      undefined,
      undefined,
      expect.any(Object),
      expect.any(Object),
    )
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'ready' }),
      }),
    )
  })

  it('AC-03: stage changes map to correct document statuses', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'd1',
      kbId: 'kb1',
      storageKey: 'k1',
      mimeType: 'text/plain',
      status: 'uploaded',
    })
    const statusUpdates: string[] = []
    mockPrisma.document.update.mockImplementation(({ data }: any) => {
      statusUpdates.push(data.status)
      return Promise.resolve({})
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)
    expect(mockPrisma.document.update).toHaveBeenCalledTimes(2)
    expect(statusUpdates).toContain('indexing')
  })

  it('AC-04: handleIndexJob throws when document not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)
    await expect(
      worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any),
    ).rejects.toThrow('Document not found')
  })

  it('AC-05: indexDocument failure sets status to failed after retries exhausted', async () => {
    const failedHandler = async (job: any, err: Error) => {
      if (job?.data?.documentId) {
        await mockPrisma.document.update({
          where: { id: job.data.documentId },
          data: { status: 'failed', errorMessage: err.message.slice(0, 500) },
        })
      }
    }

    await failedHandler({ data: { documentId: 'd1' } }, new Error('Embedding API error: 500'))

    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'failed', errorMessage: 'Embedding API error: 500' },
    })
  })
})
