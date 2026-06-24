import { BadRequestException, type Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatService } from '@/modules/chat/chat.service.js'
import type { ConversationService } from '@/modules/chat/conversation.service.js'
import type { ChatContextRetriever } from '@/modules/chat/interfaces/chat-context-retriever.interface.js'
import type { LlmProviderFactory } from '@/modules/chat/llm/llm-provider.factory.js'
import type { LlmProvider } from '@/modules/chat/llm/llm-provider.interface.js'
import type { ModelRegistryService } from '@/modules/chat/model-registry.service.js'
import type { SettingsService } from '@/modules/settings/settings.service.js'

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
      deepseek: {
        name: 'DeepSeek',
        apiKey: 'key',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
      },
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
      expect(conversationService.saveAssistantMessage).toHaveBeenCalledWith(
        's1',
        expect.any(String),
        'hello world',
      )
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
      // 历史 + 当前用户消息都应传给 LLM
      expect(streamCall[0]).toHaveLength(3)
      expect(streamCall[0][0]).toEqual({ role: 'user', content: 'previous' })
      expect(streamCall[0][1]).toEqual({ role: 'assistant', content: 'answer' })
      // 回归修复：确保当前 query 作为 user message 传入，避免首条消息出现
      // "Empty input messages" 错误（首条消息时 history 为空，需靠 query 凑出有效 messages）
      expect(streamCall[0][2]).toEqual({ role: 'user', content: 'hi' })
    })

    it('includes current query when history is empty (first message in new session)', async () => {
      // 回归用例：新会话首条消息时 loadHistory 返回 []
      conversationService.loadHistory.mockResolvedValue([])
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      for await (const _ of service.streamChat(
        'user-1',
        { conversation_id: 's-new', query: 'hello', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        // consume
      }

      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      // 关键断言：即使 history 为空，messages 也必须包含当前 query
      // 否则 LLM 会报 "Empty input messages"
      expect(streamCall[0]).toHaveLength(1)
      expect(streamCall[0][0]).toEqual({ role: 'user', content: 'hello' })
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
      // 3 = 2 条有效历史（过滤掉 attacker）+ 1 条当前 query
      expect(streamCall[0]).toHaveLength(3)
      expect(streamCall[0][0]).toEqual({ role: 'user', content: 'previous' })
      expect(streamCall[0][1]).toEqual({ role: 'assistant', content: 'answer' })
      expect(streamCall[0][2]).toEqual({ role: 'user', content: 'hi' })
    })

    it('calls context retriever when knowledge_base_ids provided', async () => {
      vi.mocked(contextRetriever.retrieve).mockResolvedValue({ context: 'retrieved context' })
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
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
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(() => {
          const err = new Error('AbortError')
          err.name = 'AbortError'
          return {
            [Symbol.asyncIterator]() {
              return {
                async next() {
                  throw err
                },
              }
            },
          }
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

    it('stops streaming early when abort signal.aborted (client disconnect)', async () => {
      // 回归：客户端断开后不应继续消耗 tokens
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(async function* () {
          yield { text: 'chunk1' }
          yield { text: 'chunk2' }
          yield { text: 'chunk3' } // 第三个 chunk 不应返回
        }),
      })
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      // 在收到第一个 chunk 后触发 abort
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

      // 只应收到第一个 chunk；后续被 abort 截断
      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks.length).toBeLessThanOrEqual(2) // 第二 chunk 可能已在路上，第三一定不会到

      // 回归：客户端主动取消时不应持久化半截回复，也不应 yield message_end
      const last = chunks[chunks.length - 1]
      expect(last.event).toBe('error')
      expect(last.error).toBe('已取消')
      expect(conversationService.saveAssistantMessage).not.toHaveBeenCalled()
    })

    it('returns error event and skips save when abort triggers before first chunk', async () => {
      // 回归：在首个 chunk 抵达前就已 abort，应跳过保存并走"已取消"路径
      let yielded = false
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(async function* () {
          yielded = true
          yield { text: 'chunk1' }
        }),
      })
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()

      // 在消费首个 chunk 前触发 abort
      const it = service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )
      abortController.abort()

      const chunks: any[] = []
      for await (const chunk of it) chunks.push(chunk)

      // 若首个 chunk 已 yield 出来，后续循环会因 abort 直接 break，
      // 随后走"已取消"路径；若没 yield 则 break 于首次迭代前，行为一致。
      const last = chunks[chunks.length - 1]
      expect(last.event).toBe('error')
      expect(last.error).toBe('已取消')
      expect(conversationService.saveAssistantMessage).not.toHaveBeenCalled()
      expect(conversationService.generateTitle).not.toHaveBeenCalled()
      // 确保 LLM 流确实被触发过，排除"根本没调用"的假象
      expect(yielded).toBe(true)
    })

    it('yields error event when saveAssistantMessage fails', async () => {
      // 回归：持久化失败时不应抛出未捕获异常，且应 yield error 事件
      conversationService.saveAssistantMessage.mockRejectedValueOnce(new Error('db down'))
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
      const abortController = new AbortController()
      const errorSpy = vi
        .spyOn((service as unknown as { logger: Logger }).logger, 'error')
        .mockImplementation(() => {})

      const chunks: any[] = []
      for await (const chunk of service.streamChat(
        'user-1',
        { conversation_id: 's1', query: 'hi', provider_key: 'deepseek' } as any,
        abortController,
      )) {
        chunks.push(chunk)
      }

      // 两个 message chunk + 1 个 error chunk，并且不应有 message_end
      expect(chunks.filter((c) => c.event === 'message')).toHaveLength(2)
      expect(chunks.filter((c) => c.event === 'error')).toHaveLength(1)
      expect(chunks.filter((c) => c.event === 'message_end')).toHaveLength(0)
      expect(chunks[chunks.length - 1].error).toContain('服务暂时不可用')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('保存 assistant 消息失败'))

      errorSpy.mockRestore()
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
      expect(llmFactory.create).not.toHaveBeenCalled()
      expect(conversationService.saveUserMessage).not.toHaveBeenCalled()
    })

    it('does not load history when provider config is invalid', async () => {
      // 回归：provider 校验失败时，不该再去查历史，减小 DB 压力
      settingsService.getDecryptedSettings.mockResolvedValue({
        providers: {},
        defaultChatProvider: '',
      } as any)
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
        expect((err as any).response?.code).toBe('PROVIDER_INVALID')
      }

      // 关键断言：loadHistory 不应被调用
      expect(conversationService.loadHistory).not.toHaveBeenCalled()
    })

    it('handles provider stream errors', async () => {
      const provider = createMockProvider({
        stream: vi.fn().mockImplementation(() => {
          const error = new Error('stream broken')
          return {
            [Symbol.asyncIterator]() {
              return {
                async next() {
                  throw error
                },
              }
            },
          }
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
      expect(chunks[0].error).toBe('服务暂时不可用，请稍后重试')
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
      settingsService.getDecryptedSettings.mockResolvedValue({
        providers: {},
        defaultChatProvider: '',
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
      expect(llmFactory.create).toHaveBeenCalledWith(
        'openai-compatible',
        expect.objectContaining({ model: 'deepseek-chat', baseURL: 'https://api.deepseek.com' }),
      )
    })

    it('includes current query when history is empty AND knowledge_base_ids provided', async () => {
      // 回归：首条消息 + RAG 组合，确保 both user 消息 + system 上下文 都传入
      conversationService.loadHistory.mockResolvedValue([])
      vi.mocked(contextRetriever.retrieve).mockResolvedValue({ context: 'ctx' })
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
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

      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      expect(streamCall[0]).toHaveLength(2)
      expect(streamCall[0]).toContainEqual({ role: 'user', content: 'hello' })
      expect(streamCall[0]).toContainEqual({
        role: 'system',
        content: expect.stringContaining('ctx'),
      })
    })

    it('uses parent_message_id to limit history (branch conversation)', async () => {
      const loadSpy = vi.spyOn(conversationService, 'loadHistory')
      conversationService.loadHistory.mockResolvedValue([
        { role: 'user', content: 'root message' },
        { role: 'assistant', content: 'root reply' },
      ])
      const provider = createMockProvider()
      llmFactory.create.mockReturnValue(provider)
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
      const streamCall = vi.mocked(provider.stream).mock.calls[0]
      // 2 条历史（分支之前）+ 1 条当前 query
      expect(streamCall[0]).toHaveLength(3)
      expect(streamCall[0]).toContainEqual({ role: 'user', content: 'root message' })
      expect(streamCall[0]).toContainEqual({ role: 'user', content: 'branch question' })

      loadSpy.mockRestore()
    })
  })
})
