import type { Job } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestContextStorage } from '../../src/common/request-context-storage.js'
import type { ConversationService } from '../../src/modules/chat/conversation.service.js'
import type { LlmProviderFactory } from '../../src/modules/chat/llm/llm-provider.factory.js'
import type { ModelRegistryService } from '../../src/modules/chat/model-registry.service.js'
import { ChatFinalizeProcessor } from '../../src/processors/chat/chat-finalize.processor.js'
import type { ChatFinalizeJobData } from '../../src/queue/index.js'

function createMockJob(overrides: Partial<ChatFinalizeJobData> = {}): Job<ChatFinalizeJobData> {
  return {
    id: 'job-1',
    name: 'finalize-chat',
    data: {
      sessionId: 'session-1',
      messageId: 'msg-1',
      userId: 'user-1',
      fullReply: 'Hello, world!',
      input: 'Hi',
      traceId: 'trace-1',
      requestId: 'req-1',
      ...overrides,
    },
  } as unknown as Job<ChatFinalizeJobData>
}

describe('ChatFinalizeProcessor', () => {
  let processor: ChatFinalizeProcessor
  let mockConversationService: Partial<ConversationService>
  let mockModelRegistry: Partial<ModelRegistryService>
  let mockLlmProviderFactory: Partial<LlmProviderFactory>

  beforeEach(() => {
    vi.restoreAllMocks()
    mockConversationService = {
      saveAssistantMessage: vi.fn().mockResolvedValue(undefined),
      generateTitle: vi.fn().mockResolvedValue(undefined),
    }
    mockModelRegistry = {
      lookup: vi.fn().mockReturnValue({
        providerKey: 'openai',
        providerName: 'OpenAI',
        baseUrl: 'https://api.openai.com',
      }),
    }
    mockLlmProviderFactory = {
      create: vi.fn().mockReturnValue({
        providerKey: 'openai',
        capabilities: [],
        stream: vi.fn(),
        invoke: vi.fn(),
      }),
    }
    processor = new ChatFinalizeProcessor(
      mockConversationService as ConversationService,
      mockModelRegistry as ModelRegistryService,
      mockLlmProviderFactory as LlmProviderFactory,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('process', () => {
    it('calls saveAssistantMessage with correct params from job data', async () => {
      const job = createMockJob()

      await processor.process(job)

      expect(mockConversationService.saveAssistantMessage).toHaveBeenCalledWith(
        'session-1',
        'msg-1',
        'Hello, world!',
      )
    })

    it('calls generateTitle when model provider is available', async () => {
      const job = createMockJob()

      await processor.process(job)

      expect(mockConversationService.generateTitle).toHaveBeenCalledWith(
        'session-1',
        'Hi',
        'Hello, world!',
        expect.objectContaining({ providerKey: 'openai' }),
      )
    })

    it('skips title generation when model registry lookup returns null', async () => {
      mockModelRegistry.lookup = vi.fn().mockReturnValue(undefined)
      processor = new ChatFinalizeProcessor(
        mockConversationService as ConversationService,
        mockModelRegistry as ModelRegistryService,
        mockLlmProviderFactory as LlmProviderFactory,
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockConversationService.saveAssistantMessage).toHaveBeenCalled()
      expect(mockConversationService.generateTitle).not.toHaveBeenCalled()
    })

    it('wraps execution in RequestContextStorage.run with job trace context', async () => {
      const runSpy = vi.spyOn(RequestContextStorage, 'run')
      const job = createMockJob()

      await processor.process(job)

      expect(runSpy).toHaveBeenCalledWith(
        { traceId: 'trace-1', requestId: 'req-1', userId: 'user-1' },
        expect.any(Function),
      )
    })

    it('re-throws error when saveAssistantMessage fails', async () => {
      mockConversationService.saveAssistantMessage = vi
        .fn()
        .mockRejectedValue(new Error('DB write failed'))
      processor = new ChatFinalizeProcessor(
        mockConversationService as ConversationService,
        mockModelRegistry as ModelRegistryService,
        mockLlmProviderFactory as LlmProviderFactory,
      )
      const job = createMockJob()

      await expect(processor.process(job)).rejects.toThrow('DB write failed')
    })

    it('does not throw when generateTitle fails (title is best-effort)', async () => {
      mockConversationService.generateTitle = vi.fn().mockRejectedValue(new Error('LLM timeout'))
      processor = new ChatFinalizeProcessor(
        mockConversationService as ConversationService,
        mockModelRegistry as ModelRegistryService,
        mockLlmProviderFactory as LlmProviderFactory,
      )
      const job = createMockJob()

      // Should not throw — title failure is caught and logged
      await expect(processor.process(job)).resolves.toBeUndefined()
      expect(mockConversationService.saveAssistantMessage).toHaveBeenCalled()
    })

    it('handles missing userId gracefully (undefined context field)', async () => {
      const job = createMockJob({ userId: undefined })
      const runSpy = vi.spyOn(RequestContextStorage, 'run')

      await processor.process(job)

      expect(runSpy).toHaveBeenCalledWith(
        { traceId: 'trace-1', requestId: 'req-1', userId: undefined },
        expect.any(Function),
      )
      expect(mockConversationService.saveAssistantMessage).toHaveBeenCalled()
    })
  })
})
