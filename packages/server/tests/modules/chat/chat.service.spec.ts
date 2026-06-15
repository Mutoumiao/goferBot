import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { ChatService } from '@/modules/chat/chat.service.js'
import type { ConversationService } from '@/modules/chat/conversation.service.js'
import type { LlmProviderFactory } from '@/modules/chat/llm/llm-provider.factory.js'
import type { LlmProvider } from '@/modules/chat/llm/llm-provider.interface.js'
import type { ModelRegistryService } from '@/modules/chat/model-registry.service.js'
import type { SettingsService } from '@/modules/settings/settings.service.js'
import type { ChatContextRetriever } from '@/modules/chat/interfaces/chat-context-retriever.interface.js'
import type { ConfigService } from '@nestjs/config'

function createMockConfigService(overrides = {}) {
  return {
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'LLM_TIMEOUT_MS') return 300_000
      if (key === 'DEEPSEEK_API_KEY') return 'deepseek-key'
      if (key === 'DEEPSEEK_BASE_URL') return 'https://api.deepseek.com'
      return defaultValue
    }),
    ...overrides,
  }
}

function createMockSettingsService(overrides = {}) {
  const settings = {
    providers: {
      deepseek: { name: 'DeepSeek', apiKey: 'key', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
    },
    defaultChatProvider: 'deepseek',
  }
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

function createMockLlmFactory(overrides = {}) {
  return {
    create: vi.fn(),
    ...overrides,
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
  let configService: ReturnType<typeof createMockConfigService>
  let settingsService: ReturnType<typeof createMockSettingsService>
  let modelRegistry: ReturnType<typeof createMockModelRegistry>
  let conversationService: ReturnType<typeof createMockConversationService>
  let llmFactory: ReturnType<typeof createMockLlmFactory>
  let contextRetriever: ChatContextRetriever

  beforeEach(() => {
    vi.clearAllMocks()
    configService = createMockConfigService()
    settingsService = createMockSettingsService()
    modelRegistry = createMockModelRegistry()
    conversationService = createMockConversationService()
    llmFactory = createMockLlmFactory()
    contextRetriever = {
      retrieve: vi.fn().mockResolvedValue({ context: null }),
    }

    llmFactory.create.mockReturnValue(createMockProvider())

    service = new ChatService(
      configService as unknown as ConfigService,
      settingsService as unknown as SettingsService,
      modelRegistry as unknown as ModelRegistryService,
      conversationService as unknown as ConversationService,
      llmFactory as unknown as LlmProviderFactory,
      contextRetriever,
    )
  })

  describe('validateChatAccess', () => {
    it('throws when conversation_id is missing', async () => {
      await expect(service.validateChatAccess('user-1', { query: 'hi' } as any)).rejects.toThrow(BadRequestException)
    })

    it('passes with valid session and provider', async () => {
      await expect(
        service.validateChatAccess('user-1', { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any),
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

    it('saves user and assistant messages', async () => {
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      expect(conversationService.saveUserMessage).toHaveBeenCalledWith('s1', 'hi')
      expect(conversationService.saveAssistantMessage).toHaveBeenCalledWith('s1', expect.any(String), 'hello world')
    })

    it('passes history to provider', async () => {
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'previous' },
        { role: 'assistant', content: 'answer' },
      ])
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      expect(streamCall[0]).toHaveLength(2)
      expect(streamCall[0][0]).toEqual({ role: 'user', content: 'previous' })
      expect(streamCall[0][1]).toEqual({ role: 'assistant', content: 'answer' })
    })

    it('filters out invalid history roles', async () => {
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'previous' },
        { role: 'attacker', content: 'inject' },
        { role: 'assistant', content: 'answer' },
      ])
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      expect(streamCall[0]).toHaveLength(2)
      expect(streamCall[0][0]).toEqual({ role: 'user', content: 'previous' })
      expect(streamCall[0][1]).toEqual({ role: 'assistant', content: 'answer' })
    })

    it('calls context retriever when knowledge_base_ids provided', async () => {
      vi.mocked(contextRetriever.retrieve).mockResolvedValue({ context: 'retrieved context' })
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek', knowledge_base_ids: ['kb1', 'kb2'] } as any,
        abortController,
      )) {
        // consume
      }

      expect(contextRetriever.retrieve).toHaveBeenCalledWith('user-1', 'hi', { kbIds: ['kb1', 'kb2'] })
      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      expect(streamCall[0]).toContainEqual({
        role: 'system',
        content: expect.stringContaining('retrieved context'),
      })
    })

    it('warns and skips retrieval when no retriever registered', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      service = new ChatService(
        configService as unknown as ConfigService,
        settingsService as unknown as SettingsService,
        modelRegistry as unknown as ModelRegistryService,
        conversationService as unknown as ConversationService,
        llmFactory as unknown as LlmProviderFactory,
        undefined,
      )
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek', knowledge_base_ids: ['kb1'] } as any,
        abortController,
      )) {
        // consume
      }

      expect(contextRetriever.retrieve).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('handles abort error gracefully', async () => {
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(async function* () {
          const err = new Error('AbortError')
          err.name = 'AbortError'
          throw err
        }),
      })
      llmFactory.create.mockReturnValue(provider)
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

    it('handles provider stream errors', async () => {
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(async function* () {
          throw new Error('stream broken')
        }),
      })
      llmFactory.create.mockReturnValue(provider)
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
      expect(chunks[0].error).toBe('stream broken')
    })

    it('triggers title generation after successful stream', async () => {
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      expect(conversationService.generateTitle).toHaveBeenCalled()
    })

    it('uses builtin model registry when provider is a model id', async () => {
      modelRegistry.lookup.mockReturnValue({
        providerKey: 'deepseek',
        providerName: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
      } as any)
      settingsService.getDecryptedSettings.mockResolvedValue({ providers: {}, defaultChatProvider: '' } as any)

      const abortController = new AbortController()
      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek-chat' } as any,
        abortController,
      )) {
        // consume
      }

      expect(modelRegistry.lookup).toHaveBeenCalledWith('deepseek-chat')
      expect(llmFactory.create).toHaveBeenCalledWith(
        'openai-compatible',
        expect.objectContaining({ model: 'deepseek-chat', baseURL: 'https://api.deepseek.com' }),
      )
    })
  })
})
