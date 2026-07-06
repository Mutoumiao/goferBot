import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestContextStorage } from '../../src/common/request-context-storage.js'
import { StreamFinalizeService } from '../../src/common/services/stream-finalize.service.js'
import type { QueueService } from '../../src/processors/queue/queue.service.js'

describe('StreamFinalizeService', () => {
  let service: StreamFinalizeService
  let mockQueueService: Partial<QueueService>

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('schedule', () => {
    it('enqueues job when queue is healthy', async () => {
      mockQueueService = {
        isHealthy: vi.fn().mockResolvedValue(true),
        addChatFinalizeJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
      }
      service = new StreamFinalizeService(mockQueueService as QueueService)

      await RequestContextStorage.run(
        { traceId: 'trace-1', requestId: 'req-1', ip: '127.0.0.1' },
        async () => {
          await service.schedule(
            {
              userId: 'user-1',
              sessionId: 'session-1',
              span: 'chat.stream.finalize',
              messageId: 'msg-1',
              input: 'hello',
              fullReply: 'hi',
            },
            [],
          )
        },
      )

      expect(mockQueueService.addChatFinalizeJob).toHaveBeenCalledWith({
        sessionId: 'session-1',
        messageId: 'msg-1',
        userId: 'user-1',
        fullReply: 'hi',
        input: 'hello',
        traceId: 'trace-1',
        requestId: 'req-1',
      })
    })

    it('falls back to microtask when queue is unhealthy', async () => {
      mockQueueService = {
        isHealthy: vi.fn().mockResolvedValue(false),
        addChatFinalizeJob: vi.fn(),
      }
      service = new StreamFinalizeService(mockQueueService as QueueService)

      const stepRun = vi.fn().mockResolvedValue(undefined)

      service.schedule(
        {
          userId: 'user-1',
          sessionId: 'session-1',
          span: 'chat.stream.finalize',
          messageId: 'msg-1',
          input: 'hello',
          fullReply: 'hi',
        },
        [{ name: 'test-step', run: stepRun }],
      )

      expect(mockQueueService.addChatFinalizeJob).not.toHaveBeenCalled()

      await vi.waitFor(() => {
        expect(stepRun).toHaveBeenCalled()
      })
    })

    it('falls back to microtask when enqueue throws', async () => {
      mockQueueService = {
        isHealthy: vi.fn().mockResolvedValue(true),
        addChatFinalizeJob: vi.fn().mockRejectedValue(new Error('Redis down')),
      }
      service = new StreamFinalizeService(mockQueueService as QueueService)

      const stepRun = vi.fn().mockResolvedValue(undefined)

      service.schedule(
        {
          userId: 'user-1',
          sessionId: 'session-1',
          span: 'chat.stream.finalize',
          messageId: 'msg-1',
          input: 'hello',
          fullReply: 'hi',
        },
        [{ name: 'test-step', run: stepRun }],
      )

      await vi.waitFor(() => {
        expect(stepRun).toHaveBeenCalled()
      })
    })
  })
})
