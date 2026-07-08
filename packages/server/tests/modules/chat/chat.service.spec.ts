import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamFinalizeService } from '@/common/services/stream-finalize.service.js'
import { ChatService } from '@/modules/chat/chat.service.js'
import type { ConversationService } from '@/modules/chat/conversation.service.js'
import type { ChatContextRetriever } from '@/modules/chat/interfaces/chat-context-retriever.interface.js'
import type { LlmProvider } from '@/modules/chat/llm/llm-provider.interface.js'
import type { ModelRegistryService } from '@/modules/chat/model-registry.service.js'
import { MODEL_PROVIDER_ERROR_CODES } from '@/modules/settings/constants.js'
import type { Settings } from '@/modules/settings/dto/settings.dto.js'
import type { ProviderRegistry } from '@/modules/settings/providers/index.js'
import type { SettingsService } from '@/modules/settings/settings.service.js'

function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    version: 2,
    providers: {
      deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        enabled: true,
        apiKey: 'key',
        baseUrl: 'https://api.deepseek.com',
        isCompleteUrl: false,
        timeoutMs: 300_000,
        models: [{ name: 'deepseek-chat', type: 'llm', enabled: true }],
      },
    },
    chat: {
      defaultProvider: 'deepseek',
      enabledProviders: ['deepseek'],
      temperature: 0.7,
    },
    rag: {
      llmProvider: '',
      embeddingProvider: '',
      timeoutMs: 60_000,
      rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
    },
    companion: {},
    indexing: {
      contextualEmbedding: true,
      contextualWindow: 1,
      parentChunkSize: 800,
      childChunkSize: 150,
      synonymDict: { zh: {}, en: {} },
    },
    appearance: { mode: 'light', fontSizeLevel: 3 },
    ...overrides,
  }
}

function createMockSettingsService(overrides = {}) {
  const settings = createMockSettings()
  return {
    getSettings: vi.fn().mockResolvedValue(settings),
    getDecryptedSettings: vi.fn().mockResolvedValue(settings),
    ...overrides,
  }
}

function createMockModelRegistry(overrides = {}) {
  return {
    lookup: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    ...overrides,
  }
}

function createMockConversationService(overrides = {}) {
  return {
    ensureOwnership: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi.fn().mockResolvedValue([]),
    saveUserMessage: vi.fn().mockResolvedValue({ id: 'm1' }),
    saveAssistantMessage: vi.fn().mockResolvedValue({ id: 'm2' }),
    generateTitle: vi.fn().mockResolvedValue(undefined),
    paginateMessages: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  }
}

function createMockProviderRegistry(mockChatClient: Record<string, any> = {}) {
  return {
    get: vi.fn().mockResolvedValue({
      toLlamaIndex: () => mockChatClient,
    }),
  }
}

function createMockProvider(overrides = {}): LlmProvider {
  return {
    providerKey: 'openai-compatible',
    capabilities: ['streaming'],
    stream: vi.fn().mockImplementation(async function* () {
      yield { text: 'hello' }
      yield { text: ' world' }
    }),
    invoke: vi.fn().mockResolvedValue('title'),
    ...overrides,
  } as unknown as LlmProvider
}

describe('ChatService', () => {
  let service: ChatService
  let settingsService: ReturnType<typeof createMockSettingsService>
  let modelRegistry: ReturnType<typeof createMockModelRegistry>
  let conversationService: ReturnType<typeof createMockConversationService>
  let providerRegistry: ReturnType<typeof createMockProviderRegistry>
  let mockChatClient: { chat: ReturnType<typeof vi.fn> }
  let finalizeService: { schedule: ReturnType<typeof vi.fn> }
  let contextRetriever: ChatContextRetriever

  beforeEach(() => {
    vi.clearAllMocks()
    settingsService = createMockSettingsService()
    modelRegistry = createMockModelRegistry()
    conversationService = createMockConversationService()

    // 创建 mock chat client — LlamaIndexProvider 需要通过 chat() 调用
    mockChatClient = {
      _providerReady: true,
      chat: vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { delta: 'hello' }
          yield { delta: ' world' }
        },
        message: { content: 'hello world' },
      }),
    } as any
    providerRegistry = createMockProviderRegistry(mockChatClient)

    finalizeService = { schedule: vi.fn() }
    contextRetriever = {
      retrieve: vi.fn().mockResolvedValue({ context: null }),
    }

    service = new ChatService(
      settingsService as unknown as SettingsService,
      modelRegistry as unknown as ModelRegistryService,
      conversationService as unknown as ConversationService,
      providerRegistry as unknown as ProviderRegistry,
      finalizeService as unknown as StreamFinalizeService,
      contextRetriever,
    )
  })

  describe('validateChatAccess', () => {
    it('throws when conversation_id is missing', async () => {
      await expect(service.validateChatAccess('user-1', { query: 'hi' } as any)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('passes with valid session and provider', async () => {
      await expect(
        service.validateChatAccess('user-1', {
          conversation_id: 's1',
          query: 'hi',
          provider_key: 'deepseek',
        } as any),
      ).resolves.toBeUndefined()
    })
  })

  describe('streamChat', () => {
    it('yields message chunks and end event', async () => {
      const chunks: any[] = []
      const abortController = new AbortController()

      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(3)
      expect(chunks[0].event).toBe('message')
      expect(chunks[0].answer).toBe('hello')
      expect(chunks[1].answer).toBe(' world')
      expect(chunks[2].event).toBe('message_end')
      expect(chunks[2].done).toBe(true)
    })

    it('saves user message and schedules assistant persistence via facade', async () => {
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      expect(conversationService.saveUserMessage).toHaveBeenCalledWith('s1', 'hi')
      // saveAssistantMessage is NOT awaited inline — it is scheduled via the facade
      expect(conversationService.saveAssistantMessage).not.toHaveBeenCalled()
      expect(finalizeService.schedule).toHaveBeenCalledWith(
        { userId: 'user-1', sessionId: 's1', span: 'chat.stream.finalize' },
        expect.any(Array),
      )
    })

    it('passes history to provider', async () => {
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'previous' },
        { role: 'assistant', content: 'answer' },
      ])
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages).toHaveLength(3)
      expect(chatCall[0].messages[0]).toEqual({ role: 'user', content: 'previous' })
      expect(chatCall[0].messages[1]).toEqual({ role: 'assistant', content: 'answer' })
      expect(chatCall[0].messages[2]).toEqual({ role: 'user', content: 'hi' })
    })

    it('includes current query when history is empty (first message in new session)', async () => {
      conversationService.loadHistory.mockResolvedValue([])
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's-new', query: 'hello', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages).toHaveLength(1)
      expect(chatCall[0].messages[0]).toEqual({ role: 'user', content: 'hello' })
    })

    it('filters out invalid history roles', async () => {
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'previous' },
        { role: 'attacker', content: 'inject' },
        { role: 'assistant', content: 'answer' },
      ])
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages).toHaveLength(3)
      expect(chatCall[0].messages[0]).toEqual({ role: 'user', content: 'previous' })
      expect(chatCall[0].messages[1]).toEqual({ role: 'assistant', content: 'answer' })
      expect(chatCall[0].messages[2]).toEqual({ role: 'user', content: 'hi' })
    })

    it('calls context retriever when knowledge_base_ids provided', async () => {
      vi.mocked(contextRetriever.retrieve).mockResolvedValue({ context: 'retrieved context' })
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: 'hi',
          provider_key: 'deepseek',
          knowledge_base_ids: ['kb1', 'kb2'],
        } as any,
        abortController,
      )) {
        // consume
      }

      expect(contextRetriever.retrieve).toHaveBeenCalledWith('user-1', 'hi', {
        kbIds: ['kb1', 'kb2'],
      })
      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages[0]).toEqual({
        role: 'user',
        content: expect.stringContaining('retrieved context'),
      })
    })

    it('warns and skips retrieval when no retriever registered', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      service = new ChatService(
        settingsService as unknown as SettingsService,
        modelRegistry as unknown as ModelRegistryService,
        conversationService as unknown as ConversationService,
        providerRegistry as unknown as ProviderRegistry,
        finalizeService as unknown as StreamFinalizeService,
        undefined,
      )
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: 'hi',
          provider_key: 'deepseek',
          knowledge_base_ids: ['kb1'],
        } as any,
        abortController,
      )) {
        // consume
      }

      expect(contextRetriever.retrieve).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('handles abort error gracefully', async () => {
      mockChatClient.chat.mockImplementation(() => {
        const err = new Error('AbortError')
        err.name = 'AbortError'
        return {
          async *[Symbol.asyncIterator]() {
            throw err
          },
          message: { content: '' },
        }
      })
      const abortController = new AbortController()

      const chunks: any[] = []
      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(1)
      expect(chunks[0].event).toBe('error')
      expect(chunks[0].error).toContain('超时')
    })

    it('stops streaming early when abort signal.aborted (client disconnect)', async () => {
      mockChatClient.chat.mockImplementation(async function* () {
        yield { delta: 'chunk1' }
        yield { delta: 'chunk2' }
        yield { delta: 'chunk3' }
        return { message: { content: '' } }
      })
      const abortController = new AbortController()

      const chunks: any[] = []
      let count = 0
      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
        count += 1
        if (count === 1) abortController.abort()
      }

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks.length).toBeLessThanOrEqual(2)
      const last = chunks[chunks.length - 1]
      expect(last.event).toBe('error')
      expect(last.error).toBe('已取消')
      expect(conversationService.saveAssistantMessage).not.toHaveBeenCalled()
    })

    it('returns error event and skips save when abort triggers before first chunk', async () => {
      let yielded = false
      mockChatClient.chat.mockImplementation(async function* () {
        yielded = true
        yield { delta: 'chunk1' }
        return { message: { content: '' } }
      })
      const abortController = new AbortController()

      const it = service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )
      abortController.abort()

      const chunks: any[] = []
      for await (const chunk of it) chunks.push(chunk)

      const last = chunks[chunks.length - 1]
      expect(last.event).toBe('error')
      expect(last.error).toBe('已取消')
      expect(conversationService.saveAssistantMessage).not.toHaveBeenCalled()
      expect(conversationService.generateTitle).not.toHaveBeenCalled()
      expect(yielded).toBe(true)
    })

    it('does not yield inline error when background persistence fails (facade isolates it)', async () => {
      conversationService.saveAssistantMessage.mockRejectedValueOnce(new Error('db down'))
      const abortController = new AbortController()

      const chunks: any[] = []
      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
      }

      expect(chunks.filter((c) => c.event === 'message')).toHaveLength(2)
      expect(chunks.filter((c) => c.event === 'error')).toHaveLength(0)
      expect(chunks.filter((c) => c.event === 'message_end')).toHaveLength(1)
      expect(finalizeService.schedule).toHaveBeenCalled()
    })

    it('rejects empty query with QUERY_EMPTY code', async () => {
      const abortController = new AbortController()
      let caught: unknown = null
      try {
        for await (const _ of service.streamChat(
          'user-1',
          { conversation_id: 's1', query: '   ', provider_key: 'deepseek' } as any,
          abortController,
        )) {
          // consume
        }
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(BadRequestException)
      expect((caught as any).response?.code).toBe('QUERY_EMPTY')

      // 空值场景不应触发任何 provider/数据库调用
      expect(providerRegistry.get).not.toHaveBeenCalled()
      expect(conversationService.saveUserMessage).not.toHaveBeenCalled()
    })

    it('does not load history when provider config is invalid', async () => {
      // 回归：provider 校验失败时，不该再去查历史，减小 DB 压力
      settingsService.getDecryptedSettings.mockResolvedValue(
        createMockSettings({
          providers: {},
          chat: { defaultProvider: '', enabledProviders: [], temperature: 0.7 },
        }),
      )
      const abortController = new AbortController()

      try {
        for await (const _ of service.streamChat(
          'user-1',
          { conversation_id: 's1', query: 'hi', provider_key: 'no-such-provider' } as any,
          abortController,
        )) {
          // consume
        }
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException)
        expect((err as any).response?.code).toBe(MODEL_PROVIDER_ERROR_CODES.NOT_FOUND)
      }

      // 关键断言：loadHistory 不应被调用
      expect(conversationService.loadHistory).not.toHaveBeenCalled()
    })

    it('handles provider stream errors', async () => {
      mockChatClient.chat.mockImplementation(() => {
        const error = new Error('stream broken')
        return {
          async *[Symbol.asyncIterator]() {
            throw error
          },
          message: { content: '' },
        }
      })
      const abortController = new AbortController()

      const chunks: any[] = []
      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(1)
      expect(chunks[0].event).toBe('error')
      expect(chunks[0].error).toBe('服务暂时不可用，请稍后重试')
    })

    it('schedules title generation via facade after successful stream', async () => {
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      expect(finalizeService.schedule).toHaveBeenCalledWith(
        { userId: 'user-1', sessionId: 's1', span: 'chat.stream.finalize' },
        expect.any(Array),
      )
      const steps = finalizeService.schedule.mock.calls[0][1]
      expect(steps.map((s: { name: string }) => s.name)).toEqual([
        'persist-assistant',
        'generate-title',
      ])
    })

    it('uses model registry to resolve provider by model id', async () => {
      modelRegistry.lookup.mockReturnValue({
        providerKey: 'deepseek',
        providerName: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
      } as any)

      const abortController = new AbortController()
      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek-chat' } as any,
        abortController,
      )) {
        // consume
      }

      expect(modelRegistry.lookup).toHaveBeenCalledWith('deepseek-chat')
      expect(providerRegistry.get).toHaveBeenCalledWith(
        'deepseek',
        'deepseek-chat',
      )
    })

    it('includes current query when history is empty AND knowledge_base_ids provided', async () => {
      conversationService.loadHistory.mockResolvedValue([])
      vi.mocked(contextRetriever.retrieve).mockResolvedValue({ context: 'ctx' })
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        {
          conversation_id: 's-new',
          query: 'hello',
          provider_key: 'deepseek',
          knowledge_base_ids: ['kb1'],
        } as any,
        abortController,
      )) {
        // consume
      }

      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages).toHaveLength(1)
      expect(chatCall[0].messages[0]).toEqual({
        role: 'user',
        content: expect.stringContaining('ctx'),
      })
    })

    it('uses parent_message_id to limit history (branch conversation)', async () => {
      const loadSpy = vi.spyOn(conversationService, 'loadHistory')
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'root message' },
        { role: 'assistant', content: 'root reply' },
      ])
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: 'branch question',
          provider_key: 'deepseek',
          parent_message_id: 'msg-parent',
        } as any,
        abortController,
      )) {
        // consume
      }

      expect(loadSpy).toHaveBeenCalledWith('s1', { beforeMessageId: 'msg-parent' })
      const chatCall = mockChatClient.chat.mock.calls[0]
      expect(chatCall[0].messages).toHaveLength(3)
      expect(chatCall[0].messages).toContainEqual({ role: 'user', content: 'root message' })
      expect(chatCall[0].messages).toContainEqual({ role: 'user', content: 'branch question' })

      loadSpy.mockRestore()
    })
  })
})
