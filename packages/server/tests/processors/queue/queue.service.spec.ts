import { describe, expect, it, vi } from 'vitest'
import { QueueService } from '@/processors/queue/queue.service.js'

describe('QueueService', () => {
  it('AC-06: addDocumentJob creates job with type index', async () => {
    const mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job1' }) }
    const mockConfig = { get: vi.fn() }
    const mockWorkerService = { startWorkers: vi.fn() }

    const service = new QueueService(mockConfig as any, mockWorkerService as any)
    // 直接设置内部 documentQueue 以绕过 isEnabled() 检查
    ;(service as any).documentQueue = mockQueue
    ;(service as any).redis = { status: 'ready' } as any // 让 isEnabled() 返回 true

    await service.addDocumentJob('d1', 'index')
    expect(mockQueue.add).toHaveBeenCalledWith('index', { documentId: 'd1', type: 'index' })
  })

  it('addChatFinalizeJob enqueues with finalize-chat name', async () => {
    const mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job-cf' }) }
    const mockConfig = { get: vi.fn() }
    const mockWorkerService = { startWorkers: vi.fn() }

    const service = new QueueService(mockConfig as any, mockWorkerService as any)
    ;(service as any).chatFinalizeQueue = mockQueue
    ;(service as any).redis = { status: 'ready' } as any

    const payload = {
      sessionId: 's1',
      messageId: 'm1',
      userId: 'u1',
      fullReply: 'hello',
      input: 'hi',
      traceId: 'trace-1',
      requestId: 'req-1',
    }
    await service.addChatFinalizeJob(payload)
    expect(mockQueue.add).toHaveBeenCalledWith('finalize-chat', payload)
  })

  it('getJobStatus resolves from chatFinalizeQueue', async () => {
    const mockJob = {
      id: 'job-cf',
      getState: vi.fn().mockResolvedValue('completed'),
      progress: 100,
      data: { sessionId: 's1' },
    }
    const mockDocQueue = { getJob: vi.fn().mockResolvedValue(null) }
    const mockEmbQueue = { getJob: vi.fn().mockResolvedValue(null) }
    const mockChatQueue = { getJob: vi.fn().mockResolvedValue(mockJob) }
    const mockConfig = { get: vi.fn() }
    const mockWorkerService = { startWorkers: vi.fn() }

    const service = new QueueService(mockConfig as any, mockWorkerService as any)
    ;(service as any).documentQueue = mockDocQueue
    ;(service as any).embeddingQueue = mockEmbQueue
    ;(service as any).chatFinalizeQueue = mockChatQueue
    ;(service as any).redis = { status: 'ready' } as any

    const status = await service.getJobStatus('job-cf')
    expect(status).toEqual({
      id: 'job-cf',
      state: 'completed',
      progress: 100,
      data: { sessionId: 's1' },
    })
  })

  it('getQueueStats includes chatFinalizeQueue counts', async () => {
    const mockDocCounts = { waiting: 1, active: 0, completed: 2, failed: 0, delayed: 0 }
    const mockEmbCounts = { waiting: 0, active: 3, completed: 1, failed: 0, delayed: 0 }
    const mockChatCounts = { waiting: 0, active: 1, completed: 5, failed: 2, delayed: 1 }
    const mockDocQueue = { getJobCounts: vi.fn().mockResolvedValue(mockDocCounts) }
    const mockEmbQueue = { getJobCounts: vi.fn().mockResolvedValue(mockEmbCounts) }
    const mockChatQueue = { getJobCounts: vi.fn().mockResolvedValue(mockChatCounts) }
    const mockConfig = { get: vi.fn() }
    const mockWorkerService = { startWorkers: vi.fn() }

    const service = new QueueService(mockConfig as any, mockWorkerService as any)
    ;(service as any).documentQueue = mockDocQueue
    ;(service as any).embeddingQueue = mockEmbQueue
    ;(service as any).chatFinalizeQueue = mockChatQueue
    ;(service as any).redis = { status: 'ready' } as any

    const stats = await service.getQueueStats()
    expect(stats).toEqual({
      documentQueue: { waiting: 1, active: 0, completed: 2, failed: 0, delayed: 0 },
      embeddingQueue: { waiting: 0, active: 3, completed: 1, failed: 0, delayed: 0 },
      chatFinalizeQueue: { waiting: 0, active: 1, completed: 5, failed: 2, delayed: 1 },
    })
  })
})
