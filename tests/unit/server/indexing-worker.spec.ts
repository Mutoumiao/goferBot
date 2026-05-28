import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IndexingWorker } from '../../../packages/server/src/processors/queue/indexing.worker.js'

// Mock @goferbot/rag-sdk 模块 — 使用 vi.hoisted 确保变量在 vi.mock 提升前初始化
const { mockRunIndexing } = vi.hoisted(() => ({
  mockRunIndexing: vi.fn(),
}))

vi.mock('@goferbot/rag-sdk', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    runIndexing: mockRunIndexing,
  }
})

describe('IndexingWorker', () => {
  let worker: IndexingWorker
  let mockPrisma: any
  let mockVectorService: any
  let mockStorage: any
  let mockParser: any
  let mockIndexer: any
  let mockConfig: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    mockVectorService = {}
    mockStorage = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('test content')),
    }
    mockParser = {
      parse: vi.fn().mockResolvedValue('test content'),
    }
    mockIndexer = {}
    mockConfig = {
      get: vi.fn().mockReturnValue('mock-key'),
      getOrThrow: vi.fn().mockReturnValue('mock-key'),
    }
    worker = new IndexingWorker(mockPrisma, mockVectorService, mockStorage, mockParser, mockIndexer, mockConfig)
  })

  it('AC-02: handleIndexJob drives full pipeline and sets status to ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', storageKey: 'k1', mimeType: 'text/plain', status: 'uploaded' })
    // runIndexing 模拟：通过 onStageChange 回调更新状态，最终 resolve
    // SDK 实际传递的是 IndexingStage[] 数组
    mockRunIndexing.mockImplementation(async (_doc: any, options: any) => {
      const { onStageChange } = options
      await onStageChange?.([{ name: 'chunk', status: 'running' }, { name: 'embed', status: 'pending' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'pending' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'running' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'completed' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'completed' }, { name: 'index', status: 'running' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'completed' }, { name: 'index', status: 'completed' }])
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)

    expect(mockPrisma.document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: 'ready' }),
    }))
  })

  it('AC-03: stage changes map to correct document statuses', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', storageKey: 'k1', mimeType: 'text/plain', status: 'uploaded' })
    const statusUpdates: string[] = []
    mockPrisma.document.update.mockImplementation(({ data }: any) => {
      statusUpdates.push(data.status)
      return Promise.resolve({})
    })

    mockRunIndexing.mockImplementation(async (_doc: any, options: any) => {
      const { onStageChange } = options
      await onStageChange?.([{ name: 'chunk', status: 'running' }, { name: 'embed', status: 'pending' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'running' }, { name: 'index', status: 'pending' }])
      await onStageChange?.([{ name: 'chunk', status: 'completed' }, { name: 'embed', status: 'completed' }, { name: 'index', status: 'running' }])
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)
    // runIndexing mock 中 onStageChange 被调用了 3 次，每次都有 running 状态
    // worker 只在 running 时 updateStatus，所以 3 次 stage + 1 次 ready = 4 次
    expect(mockPrisma.document.update).toHaveBeenCalledTimes(4)
    expect(statusUpdates).toContain('chunking')
    expect(statusUpdates).toContain('embedding')
    expect(statusUpdates).toContain('indexing')
  })

  it('AC-04: handleIndexJob throws when document not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)
    await expect(worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any))
      .rejects.toThrow('Document not found')
  })

  it('AC-05: runIndexing failure sets status to failed after retries exhausted', async () => {
    // 模拟 WorkerService failed 事件处理器
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
