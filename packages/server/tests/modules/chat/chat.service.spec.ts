import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StreamFinalizeService } from '@/common/services/stream-finalize.service.js'
import { ChatService } from '@/modules/chat/chat.service.js'
import type { ConversationService } from '@/modules/chat/conversation.service.js'
import type { ModelRegistryService } from '@/modules/chat/model-registry.service.js'
import type { KbRepository } from '@/modules/knowledge-base/repositories/kb.repository.js'
import { MODEL_PROVIDER_ERROR_CODES } from '@/modules/settings/constants.js'
import type { Settings } from '@/modules/settings/dto/settings.dto.js'
import type { ProviderRegistry } from '@/modules/settings/providers/index.js'
import type { SettingsService } from '@/modules/settings/settings.service.js'
import type { KnowledgeAiClient } from '@/processors/knowledge-ai/knowledge-ai.client.js'
import type { KnowledgeAiProviderResolver } from '@/processors/knowledge-ai/knowledge-ai.provider-resolver.js'

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
        models: [
          { name: 'deepseek-chat', type: 'llm', enabled: true },
          { name: 'text-embedding-3-small', type: 'embedding', enabled: true },
        ],
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
      retrievalMode: 'strict',
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
    updateAssistantMessage: vi.fn().mockResolvedValue({ id: 'm2' }),
    generateTitle: vi.fn().mockResolvedValue(undefined),
    paginateMessages: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  }
}

function createMockProviderRegistry(mockChatClient: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue({
      toLangChain: () => mockChatClient,
    }),
  }
}

const KB_ID = '11111111-1111-1111-1111-111111111111'

describe('ChatService', () => {
  let service: ChatService
  let settingsService: ReturnType<typeof createMockSettingsService>
  let modelRegistry: ReturnType<typeof createMockModelRegistry>
  let conversationService: ReturnType<typeof createMockConversationService>
  let providerRegistry: ReturnType<typeof createMockProviderRegistry>
  let mockChatClient: { chat: ReturnType<typeof vi.fn> }
  let finalizeService: { schedule: ReturnType<typeof vi.fn> }
  let knowledgeAi: { stream: ReturnType<typeof vi.fn> }
  let kbRepository: { findByIdAndUser: ReturnType<typeof vi.fn> }
  let knowledgeAiProviderResolver: { resolveEmbeddingConfig: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    settingsService = createMockSettingsService()
    modelRegistry = createMockModelRegistry()
    conversationService = createMockConversationService()

    mockChatClient = {
      invoke: vi.fn().mockResolvedValue({ content: 'hello' }),
      stream: vi.fn().mockImplementation(async function* () {
        yield { content: 'hello' }
      }),
    } as any
    providerRegistry = createMockProviderRegistry(mockChatClient)

    finalizeService = { schedule: vi.fn() }
    knowledgeAi = {
      stream: vi.fn().mockImplementation(async function* () {
        yield {
          event: 'sources',
          data: {
            sources: [
              {
                kb_id: KB_ID,
                document_id: '22222222-2222-2222-2222-222222222222',
                content: 'ctx',
              },
            ],
            retrieval_empty: false,
          },
        }
        yield { event: 'message', data: { delta: 'hello' } }
        yield { event: 'message', data: { delta: ' world' } }
        yield { event: 'message_end', data: { answer: 'hello world', retrieval_empty: false } }
      }),
    }
    kbRepository = {
      findByIdAndUser: vi.fn().mockResolvedValue({ id: KB_ID, userId: 'user-1' }),
    }
    knowledgeAiProviderResolver = {
      resolveEmbeddingConfig: vi.fn().mockResolvedValue({
        embedding_model: 'text-embedding-3-small',
        embedding_api_key: 'key',
        embedding_base_url: 'https://api.deepseek.com',
      }),
    }

    service = new ChatService(
      settingsService as unknown as SettingsService,
      modelRegistry as unknown as ModelRegistryService,
      conversationService as unknown as ConversationService,
      providerRegistry as unknown as ProviderRegistry,
      finalizeService as unknown as StreamFinalizeService,
      knowledgeAi as unknown as KnowledgeAiClient,
      kbRepository as unknown as KbRepository,
      knowledgeAiProviderResolver as unknown as KnowledgeAiProviderResolver,
    )
  })

  describe('validateChatAccess', () => {
    it('throws when conversation_id is missing', async () => {
      await expect(
        service.validateChatAccess('user-1', {
          query: 'hi',
          knowledge_base_ids: [KB_ID],
        } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('passes with valid session, kb and provider', async () => {
      await expect(
        service.validateChatAccess('user-1', {
          conversation_id: 's1',
          query: 'hi',
          provider_key: 'deepseek',
          knowledge_base_ids: [KB_ID],
        } as any),
      ).resolves.toBeUndefined()
    })

    it('rejects unauthorized kb', async () => {
      kbRepository.findByIdAndUser.mockResolvedValue(null)
      await expect(
        service.validateChatAccess('user-1', {
          conversation_id: 's1',
          query: 'hi',
          knowledge_base_ids: [KB_ID],
        } as any),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('streamChat', () => {
    it('throws when conversation_id missing', async () => {
      const gen = service.streamChat('user-1', { query: 'hi' } as any, new AbortController())
      await expect(gen.next()).rejects.toThrow(BadRequestException)
    })

    it('throws when kb missing', async () => {
      const gen = service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', knowledge_base_ids: [] } as any,
        new AbortController(),
      )
      await expect(gen.next()).rejects.toThrow(BadRequestException)
    })

    it('streams sources → message → message_end via Knowledge AI', async () => {
      const chunks: any[] = []
      const gen = service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: '什么是 RAG',
          knowledge_base_ids: [KB_ID],
          provider_key: 'deepseek',
        } as any,
        new AbortController(),
      )
      for await (const c of gen) {
        chunks.push(c)
      }

      expect(chunks[0].event).toBe('sources')
      expect(chunks[0].sources[0].kb_id).toBe(KB_ID)
      expect(chunks.some((c) => c.event === 'message')).toBe(true)
      expect(chunks.at(-1)?.event).toBe('message_end')
      expect(conversationService.updateAssistantMessage).toHaveBeenCalled()
      expect(finalizeService.schedule).toHaveBeenCalled()
    })

    it('marks failed when Knowledge AI returns error event', async () => {
      knowledgeAi.stream = vi.fn().mockImplementation(async function* () {
        yield {
          event: 'error',
          data: { message: 'upstream down' },
        }
      })
      const chunks: any[] = []
      const gen = service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: 'q',
          knowledge_base_ids: [KB_ID],
          provider_key: 'deepseek',
        } as any,
        new AbortController(),
      )
      for await (const c of gen) {
        chunks.push(c)
      }
      expect(chunks.at(-1)?.event).toBe('error')
      expect(conversationService.updateAssistantMessage).toHaveBeenCalledWith(
        's1',
        expect.any(String),
        expect.objectContaining({ status: 'failed' }),
      )
    })

    it('rejects empty query', async () => {
      const gen = service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: '   ',
          knowledge_base_ids: [KB_ID],
        } as any,
        new AbortController(),
      )
      await expect(gen.next()).rejects.toThrow(BadRequestException)
    })

    it('rejects missing default provider', async () => {
      settingsService.getDecryptedSettings.mockResolvedValue(
        createMockSettings({
          chat: { defaultProvider: '', enabledProviders: [], temperature: 0.7 },
        }),
      )
      const gen = service.streamChat(
        'user-1',
        {
          conversation_id: 's1',
          query: 'hi',
          knowledge_base_ids: [KB_ID],
        } as any,
        new AbortController(),
      )
      await expect(gen.next()).rejects.toMatchObject({
        response: expect.objectContaining({
          code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        }),
      })
    })
  })
})
