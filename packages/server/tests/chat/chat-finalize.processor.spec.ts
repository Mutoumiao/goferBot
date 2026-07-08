import type { Job } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestContextStorage } from '../../src/common/request-context-storage.js'
import type { ConversationService } from '../../src/modules/chat/conversation.service.js'
import type { ModelProvider, Settings } from '../../src/modules/settings/dto/settings.dto.js'
import type { ProviderRegistry } from '../../src/modules/settings/providers/index.js'
import type { SystemConfigService } from '../../src/modules/settings/system-config.service.js'
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

function buildSettings(overrides: Partial<Settings> = {}): Settings {
  const defaultProvider: ModelProvider = {
    id: 'default-llm',
    name: 'Default LLM',
    enabled: true,
    apiKey: 'sk-test-api-key',
    baseUrl: 'https://api.openai.com',
    isCompleteUrl: false,
    timeoutMs: 30_000,
    models: [{ name: 'gpt-4o-mini', type: 'llm', enabled: true }],
  }
  const fallbackProvider: ModelProvider = {
    ...defaultProvider,
    id: 'backup-llm',
    name: 'Backup LLM',
    apiKey: 'sk-test-backup-key',
  }
  const base: Settings = {
    version: 2,
    providers: {
      'default-llm': defaultProvider,
      'backup-llm': fallbackProvider,
    },
    chat: {
      defaultProvider: 'default-llm',
      enabledProviders: ['default-llm', 'backup-llm'],
      temperature: 0.7,
    },
    rag: {
      llmProvider: 'default-llm',
      embeddingProvider: 'default-llm',
      rerankerAllowedModelPrefixes: ['BAAI/'],
      timeoutMs: 60_000,
    },
    companion: {},
    indexing: {
      contextualEmbedding: false,
      contextualWindow: 1,
      parentChunkSize: 800,
      childChunkSize: 150,
      synonymDict: { zh: {}, en: {} },
    },
    appearance: { mode: 'light', fontSizeLevel: 5 },
  }
  return { ...base, ...overrides }
}

describe('ChatFinalizeProcessor', () => {
  let processor: ChatFinalizeProcessor
  let mockConversationService: Partial<ConversationService>
  let mockSystemConfigService: Partial<SystemConfigService>
  let mockProviderRegistry: Partial<ProviderRegistry>

  beforeEach(() => {
    vi.restoreAllMocks()
    mockConversationService = {
      saveAssistantMessage: vi.fn().mockResolvedValue(undefined),
      generateTitle: vi.fn().mockResolvedValue(undefined),
    }
    mockSystemConfigService = {
      getDecryptedSystemConfig: vi.fn().mockResolvedValue(buildSettings()),
    }
    mockProviderRegistry = {
      get: vi.fn().mockResolvedValue({
        toLlamaIndex: () => ({
          _providerReady: true,
          chat: vi.fn().mockResolvedValue({ message: { content: 'title' } }),
        }),
      }),
    }
    processor = new ChatFinalizeProcessor(
      mockConversationService as ConversationService,
      mockSystemConfigService as SystemConfigService,
      mockProviderRegistry as ProviderRegistry,
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

    it('resolves title provider from system config defaultProvider and passes decrypted apiKey (no hardcoded empty apiKey)', async () => {
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('default-llm', 'gpt-4o-mini')
      expect(mockConversationService.generateTitle).toHaveBeenCalledWith(
        'session-1',
        'Hi',
        'Hello, world!',
        expect.objectContaining({ providerKey: 'llama-index' }),
      )
    })

    it('does not fall back to hardcoded "default" provider id when config is absent', async () => {
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          chat: {
            defaultProvider: undefined,
            enabledProviders: [],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).not.toHaveBeenCalled()
      expect(mockConversationService.generateTitle).not.toHaveBeenCalled()
    })

    it('falls back to first enabled LLM provider when defaultProvider is not set', async () => {
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          chat: {
            defaultProvider: undefined,
            enabledProviders: ['backup-llm'],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('backup-llm', 'gpt-4o-mini')
      expect(mockConversationService.generateTitle).toHaveBeenCalled()
    })

    it('skips title generation when no usable LLM provider is enabled', async () => {
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          chat: {
            defaultProvider: undefined,
            enabledProviders: [],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockConversationService.saveAssistantMessage).toHaveBeenCalled()
      expect(mockConversationService.generateTitle).not.toHaveBeenCalled()
    })

    it('skips disabled providers and falls back to next enabled', async () => {
      const disabledProvider: ModelProvider = {
        id: 'disabled-llm',
        name: 'Disabled LLM',
        enabled: false,
        apiKey: 'sk-disabled-key',
        baseUrl: 'https://api.openai.com',
        isCompleteUrl: false,
        timeoutMs: 30_000,
        models: [{ name: 'gpt-4o', type: 'llm', enabled: true }],
      }
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          providers: {
            'disabled-llm': disabledProvider,
            'backup-llm': {
              ...disabledProvider,
              id: 'backup-llm',
              name: 'Backup LLM',
              enabled: true,
              apiKey: 'sk-test-backup-key',
            },
          },
          chat: {
            defaultProvider: 'disabled-llm',
            enabledProviders: ['disabled-llm', 'backup-llm'],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('backup-llm', 'gpt-4o')
    })

    it('skips non-llm providers and falls back to next enabled llm provider', async () => {
      const embeddingProvider: ModelProvider = {
        id: 'embed-llm',
        name: 'Embed',
        enabled: true,
        apiKey: 'sk-embed-key',
        baseUrl: 'https://api.openai.com',
        isCompleteUrl: false,
        timeoutMs: 30_000,
        models: [{ name: 'text-embedding-3-small', type: 'embedding', enabled: true }],
      }
      const backupLlm: ModelProvider = {
        ...embeddingProvider,
        id: 'backup-llm',
        name: 'Backup LLM',
        apiKey: 'sk-test-backup-key',
        models: [{ name: 'gpt-4o-mini', type: 'llm', enabled: true }],
      }
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          providers: {
            'embed-llm': embeddingProvider,
            'backup-llm': backupLlm,
          },
          chat: {
            defaultProvider: 'embed-llm',
            enabledProviders: ['embed-llm', 'backup-llm'],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('backup-llm', 'gpt-4o-mini')
    })

    it('skips provider when model or apiKey is missing', async () => {
      const incompleteProvider: ModelProvider = {
        id: 'incomplete-llm',
        name: 'Incomplete',
        enabled: true,
        apiKey: '',
        baseUrl: 'https://api.openai.com',
        isCompleteUrl: false,
        timeoutMs: 30_000,
        models: [],
      }
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          providers: {
            'incomplete-llm': incompleteProvider,
            'backup-llm': {
              ...incompleteProvider,
              id: 'backup-llm',
              name: 'Backup LLM',
              apiKey: 'sk-test-backup-key',
              models: [{ name: 'gpt-4o-mini', type: 'llm', enabled: true }],
            },
          },
          chat: {
            defaultProvider: 'incomplete-llm',
            enabledProviders: ['incomplete-llm', 'backup-llm'],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('backup-llm', 'gpt-4o-mini')
    })

    it('ignores defaultProvider when not present in enabledProviders and falls back', async () => {
      mockSystemConfigService.getDecryptedSystemConfig = vi.fn().mockResolvedValue(
        buildSettings({
          chat: {
            defaultProvider: 'unknown-llm',
            enabledProviders: ['backup-llm'],
            temperature: 0.7,
          },
        }),
      )
      const job = createMockJob()

      await processor.process(job)

      expect(mockProviderRegistry.get).toHaveBeenCalledWith('backup-llm', 'gpt-4o-mini')
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
      const job = createMockJob()

      await expect(processor.process(job)).rejects.toThrow('DB write failed')
    })

    it('does not throw when generateTitle fails (title is best-effort)', async () => {
      mockConversationService.generateTitle = vi.fn().mockRejectedValue(new Error('LLM timeout'))
      const job = createMockJob()

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
