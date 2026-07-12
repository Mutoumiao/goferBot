import { randomUUID } from 'node:crypto'
import type { ChatMessagesChunk } from '@goferbot/data'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { StreamFinalizeService } from '../../common/services/stream-finalize.service.js'
import { KnowledgeAiClient } from '../../processors/knowledge-ai/knowledge-ai.client.js'
import { KnowledgeAiProviderResolver } from '../../processors/knowledge-ai/knowledge-ai.provider-resolver.js'
import type { KnowledgeAiSourceItem } from '../../processors/knowledge-ai/knowledge-ai.types.js'
import { KbRepository } from '../knowledge-base/repositories/kb.repository.js'
import { MODEL_PROVIDER_ERROR_CODES } from '../settings/constants.js'
import type { ModelProvider } from '../settings/dto/settings.dto.js'
import { parseModelKey } from '../settings/model-provider.service.js'
import {
  inferKnowledgeAiProviderKind,
  normalizeProviderServiceRoot,
  ProviderRegistry,
  rewriteLoopbackForKnowledgeAi,
} from '../settings/providers/index.js'
import { SettingsService } from '../settings/settings.service.js'
import { ConversationService } from './conversation.service.js'
import type { ChatMessagesDto } from './dto/chat.dto.js'
import { LangChainLlmProvider } from './llm/langchain-llm-provider.service.js'
import type { LlmProvider } from './llm/llm-provider.interface.js'
import { ModelRegistryService } from './model-registry.service.js'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly conversationService: ConversationService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly finalizeService: StreamFinalizeService,
    private readonly knowledgeAi: KnowledgeAiClient,
    private readonly kbRepository: KbRepository,
    private readonly knowledgeAiProviderResolver: KnowledgeAiProviderResolver,
  ) {}

  async validateChatAccess(userId: string, dto: ChatMessagesDto): Promise<void> {
    const sessionId = dto.conversation_id
    if (!sessionId) {
      throw new BadRequestException({
        code: 'CONVERSATION_ID_REQUIRED',
        message: 'conversation_id 不能为空',
      })
    }
    await this.conversationService.ensureOwnership(userId, sessionId)
    await this.assertKbOwnership(userId, dto.knowledge_base_ids)
    // Still validate chat provider exists (used for title gen / injection)
    await this.resolveProviderConfig(userId, dto.provider_key, dto.model)
  }

  async *streamChat(
    userId: string,
    dto: ChatMessagesDto,
    abortController: AbortController,
  ): AsyncGenerator<ChatMessagesChunk> {
    const messageId = randomUUID()
    const sessionId = dto.conversation_id
    if (!sessionId) {
      throw new BadRequestException({
        code: 'CONVERSATION_ID_REQUIRED',
        message: 'conversation_id 不能为空',
      })
    }
    const input = dto.query

    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException({
        code: 'QUERY_EMPTY',
        message: '输入内容不能为空',
      })
    }

    const kbIds = dto.knowledge_base_ids
    if (!kbIds?.length) {
      throw new BadRequestException({
        code: 'KB_REQUIRED',
        message: 'Chat 知识问答必须绑定至少一个知识库',
      })
    }
    await this.assertKbOwnership(userId, kbIds)

    const { providerConfig, timeoutMs, llmProvider, retrievalMode } =
      await this.resolveProviderConfig(userId, dto.provider_key, dto.model)

    const history = await this.conversationService.loadHistory(sessionId, {
      beforeMessageId: dto.parent_message_id ?? undefined,
    })

    await this.conversationService.saveUserMessage(sessionId, input)

    // Assistant placeholder (streaming)
    await this.conversationService.saveAssistantMessage(sessionId, messageId, '', {
      status: 'streaming',
      metadata: {},
    })

    const historyPayload = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    const mode = dto.retrieval_mode ?? retrievalMode ?? 'strict'
    const traceId = randomUUID()
    let fullReply = ''
    let sources: KnowledgeAiSourceItem[] = []
    let retrievalEmpty = false
    let terminalStatus: 'completed' | 'cancelled' | 'failed' = 'completed'

    try {
      for await (const frame of this.knowledgeAi.stream(
        {
          query: input,
          kb_ids: kbIds,
          top_k: 5,
          retrieval_mode: mode,
          history: historyPayload,
          trace_id: traceId,
          conversation_id: sessionId,
          message_id: messageId,
          _provider: providerConfig,
        },
        { signal: abortController.signal, generationTimeoutMs: timeoutMs },
      )) {
        if (abortController.signal.aborted) {
          terminalStatus = 'cancelled'
          break
        }

        if (frame.event === 'sources') {
          sources = frame.data.sources ?? []
          retrievalEmpty = Boolean(frame.data.retrieval_empty)
          yield {
            event: 'sources',
            conversation_id: sessionId,
            message_id: messageId,
            sources: sources.map((s) => ({
              kb_id: s.kb_id,
              document_id: s.document_id,
              chunk_id: s.chunk_id ?? undefined,
              content: s.content ?? undefined,
              score: s.score ?? undefined,
              parent_id: s.parent_id ?? undefined,
            })),
            retrieval_empty: retrievalEmpty,
            done: false,
          }
        } else if (frame.event === 'message') {
          const delta = frame.data.delta ?? frame.data.answer ?? ''
          if (delta) {
            fullReply += delta
            yield {
              event: 'message',
              conversation_id: sessionId,
              message_id: messageId,
              answer: delta,
              done: false,
            }
          }
        } else if (frame.event === 'message_end') {
          if (frame.data.answer && !fullReply) {
            fullReply = frame.data.answer
          }
          retrievalEmpty = Boolean(frame.data.retrieval_empty) || retrievalEmpty
        } else if (frame.event === 'error') {
          terminalStatus = 'failed'
          const errMsg = frame.data.message || frame.data.error || '知识问答失败'
          await this.conversationService.updateAssistantMessage(sessionId, messageId, {
            content: fullReply,
            status: 'failed',
            metadata: { sources, retrieval_empty: retrievalEmpty, error: errMsg },
          })
          yield {
            event: 'error',
            conversation_id: sessionId,
            message_id: messageId,
            answer: '',
            done: true,
            error: errMsg,
          }
          return
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        terminalStatus = abortController.signal.aborted ? 'cancelled' : 'failed'
        await this.conversationService.updateAssistantMessage(sessionId, messageId, {
          content: fullReply,
          status: terminalStatus,
          metadata: { sources, retrieval_empty: retrievalEmpty },
        })
        yield {
          event: terminalStatus === 'cancelled' ? 'error' : 'error',
          conversation_id: sessionId,
          message_id: messageId,
          answer: '',
          done: true,
          error:
            terminalStatus === 'cancelled'
              ? '已取消'
              : `知识问答超时（${timeoutMs / 1000} 秒）`,
        }
        return
      }
      this.logger.error(
        `Knowledge AI 流异常 sessionId=${sessionId}: ${err instanceof Error ? err.message : '未知错误'}`,
      )
      await this.conversationService.updateAssistantMessage(sessionId, messageId, {
        content: fullReply,
        status: 'failed',
        metadata: { sources, retrieval_empty: retrievalEmpty },
      })
      yield {
        event: 'error',
        conversation_id: sessionId,
        message_id: messageId,
        answer: '',
        done: true,
        error: '服务暂时不可用，请稍后重试',
      }
      return
    }

    if (abortController.signal.aborted || terminalStatus === 'cancelled') {
      await this.conversationService.updateAssistantMessage(sessionId, messageId, {
        content: fullReply,
        status: 'cancelled',
        metadata: { sources, retrieval_empty: retrievalEmpty },
      })
      yield {
        event: 'error',
        conversation_id: sessionId,
        message_id: messageId,
        answer: '',
        done: true,
        error: '已取消',
      }
      return
    }

    // completed (including strict empty retrieval)
    await this.conversationService.updateAssistantMessage(sessionId, messageId, {
      content: fullReply,
      status: 'completed',
      metadata: {
        sources,
        retrieval_empty: retrievalEmpty,
      },
    })

    this.finalizeService.schedule({ userId, sessionId, span: 'chat.stream.finalize' }, [
      {
        name: 'generate-title',
        run: () =>
          this.conversationService.generateTitle(sessionId, input, fullReply, llmProvider),
      },
    ])

    yield {
      event: 'message_end',
      conversation_id: sessionId,
      message_id: messageId,
      answer: '',
      done: true,
      retrieval_empty: retrievalEmpty,
    }
  }

  private async assertKbOwnership(userId: string, kbIds: string[]): Promise<void> {
    if (!kbIds?.length) {
      throw new BadRequestException({
        code: 'KB_REQUIRED',
        message: 'Chat 知识问答必须绑定至少一个知识库',
      })
    }
    for (const kbId of kbIds) {
      const kb = await this.kbRepository.findByIdAndUser(kbId, userId)
      if (!kb) {
        // 404 to avoid leaking existence
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '知识库不存在',
        })
      }
    }
  }

  private async createProvider(providerId: string, modelName: string): Promise<LlmProvider> {
    const baseProvider = await this.providerRegistry.get(providerId, modelName)
    return new LangChainLlmProvider(baseProvider.toLangChain())
  }

  private async resolveProviderConfig(
    userId: string,
    providerKey?: string,
    dtoModel?: string,
  ): Promise<{
    providerConfig: {
      llm_model?: string
      llm_api_key?: string
      llm_base_url?: string
      llm_provider_kind?: 'ollama' | 'openai_compat'
      embedding_model?: string
      embedding_api_key?: string
      embedding_base_url?: string
      embedding_provider_kind?: 'ollama' | 'openai_compat'
      rerank_model?: string
      rerank_api_key?: string
      rerank_base_url?: string
      rerank_provider_kind?: 'ollama' | 'openai_compat'
    }
    model: string
    timeoutMs: number
    llmProvider: LlmProvider
    retrievalMode: 'strict' | 'loose'
  }> {
    const settings = await this.settingsService.getDecryptedSettings(userId)
    const resolvedKey = providerKey?.trim() || settings.chat.defaultProvider

    if (!resolvedKey) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: '未配置 Chat 默认模型提供商',
      })
    }

    const { providerId: parsedProviderId, modelName: parsedModelName } = parseModelKey(resolvedKey)
    let providerId = parsedProviderId
    let modelName = parsedModelName

    const modelInfo = this.modelRegistry.lookup(resolvedKey)
    if (modelInfo) {
      providerId = modelInfo.providerKey
      modelName = modelInfo.model
    }

    const enabledProviders = settings.chat.enabledProviders
    if (
      enabledProviders.length > 0 &&
      !enabledProviders.includes(resolvedKey) &&
      !enabledProviders.includes(providerId)
    ) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_ENABLED,
        message: `该模型提供商未在 Chat 中启用：${resolvedKey}`,
      })
    }

    const provider: ModelProvider | undefined = settings.providers[providerId]
    if (!provider) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
        message: `模型提供商不存在：${providerId}`,
      })
    }
    if (!provider.enabled) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.DISABLED,
        message: `模型提供商已禁用：${providerId}`,
      })
    }

    const model = modelName
      ? provider.models.find((m) => m.name === modelName && m.type === 'llm')
      : provider.models.find((m) => m.type === 'llm' && m.enabled)
    if (!model?.enabled) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
        message: `模型提供商 ${providerId} 没有启用的 LLM 模型${modelName ? `：${modelName}` : ''}`,
      })
    }

    const resolvedModelName = dtoModel ?? model.name
    if (dtoModel && dtoModel !== model.name) {
      const overrideModel = provider.models.find(
        (m) => m.name === dtoModel && m.type === 'llm' && m.enabled,
      )
      if (!overrideModel) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
          message: `模型 ${dtoModel} 不存在于提供商 ${providerId} 或未启用的 LLM 模型`,
        })
      }
    }

    // Embedding/rerank MUST match IndexingWorker (rag.embeddingProvider pool), not only chat LLM provider.
    // Otherwise hybrid vector search uses a different space than indexed chunks.
    let embeddingResolved: Awaited<
      ReturnType<KnowledgeAiProviderResolver['resolveEmbeddingConfig']>
    >
    try {
      embeddingResolved = await this.knowledgeAiProviderResolver.resolveEmbeddingConfig(userId)
    } catch (err) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
        message: err instanceof Error ? err.message : '未配置可用的 embedding 模型',
      })
    }

    const timeoutMs =
      Number(process.env.KNOWLEDGE_AI_GENERATION_TIMEOUT_MS) || provider.timeoutMs || 180_000

    const llmBaseUrl = provider.baseUrl?.trim()
    if (!llmBaseUrl) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: `模型提供商 ${providerId} 未配置 baseUrl：Knowledge AI 不使用默认厂商地址，请在 Admin 填写 API Base URL`,
      })
    }
    if (!provider.apiKey?.trim()) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: `模型提供商 ${providerId} 未配置 apiKey`,
      })
    }

    const llmProvider = await this.createProvider(providerId, resolvedModelName)
    const retrievalMode =
      settings.rag?.retrievalMode === 'loose' ? ('loose' as const) : ('strict' as const)

    const llmKind = inferKnowledgeAiProviderKind(provider.id, provider.name, llmBaseUrl)
    const llmRoot = rewriteLoopbackForKnowledgeAi(normalizeProviderServiceRoot(llmBaseUrl))

    return {
      providerConfig: {
        llm_model: resolvedModelName,
        llm_api_key: provider.apiKey,
        llm_base_url: llmRoot,
        llm_provider_kind: llmKind,
        embedding_model: embeddingResolved.embedding_model,
        embedding_api_key: embeddingResolved.embedding_api_key,
        embedding_base_url: embeddingResolved.embedding_base_url,
        embedding_provider_kind: embeddingResolved.embedding_provider_kind,
        ...(embeddingResolved.rerank_model
          ? {
              rerank_model: embeddingResolved.rerank_model,
              rerank_api_key: embeddingResolved.rerank_api_key,
              rerank_base_url: embeddingResolved.rerank_base_url,
              rerank_provider_kind: embeddingResolved.rerank_provider_kind,
            }
          : {}),
      },
      model: resolvedModelName,
      timeoutMs,
      llmProvider,
      retrievalMode,
    }
  }
}
