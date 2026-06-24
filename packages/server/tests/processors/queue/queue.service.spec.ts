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
})
