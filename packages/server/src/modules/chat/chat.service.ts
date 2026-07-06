import { randomUUID } from 'node:crypto'
import type { ChatMessagesChunk } from '@goferbot/data'
import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { StreamFinalizeService } from '../../common/services/stream-finalize.service.js'
import { MODEL_PROVIDER_ERROR_CODES } from '../settings/constants.js'
import type { ModelProvider } from '../settings/dto/settings.dto.js'
import { parseModelKey } from '../settings/model-provider.service.js'
import { SettingsService } from '../settings/settings.service.js'
import { ConversationService } from './conversation.service.js'
import type { ChatMessagesDto } from './dto/chat.dto.js'
import {
  CHAT_CONTEXT_RETRIEVER,
  type ChatContextRetriever,
} from './interfaces/chat-context-retriever.interface.js'
import { LlmProviderFactory } from './llm/llm-provider.factory.js'
import type { LlmMessage, LlmProvider } from './llm/llm-provider.interface.js'
import { ModelRegistryService } from './model-registry.service.js'

function isLlmMessage(m: { role: string; content: string }): m is LlmMessage {
  return m.role === 'system' || m.role === 'user' || m.role === 'assistant'
}

/**
 * 根据 isCompleteUrl 解析 LLM baseURL。
 * - false（默认）：baseUrl 是 API 网关地址，SDK 自动拼 /chat/completions
 * - true：baseUrl 是完整请求地址，strip /chat/completions 后缀供 SDK 重新拼接
 */
function resolveLlmBaseURL(baseUrl: string, isCompleteUrl: boolean): string {
  if (!baseUrl) return 'https://api.openai.com'
  if (!isCompleteUrl) return baseUrl
  // ponytail: strip 已知端点后缀，SDK 会重新拼接
  return baseUrl.replace(/\/chat\/completions$/, '')
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly conversationService: ConversationService,
    private readonly llmFactory: LlmProviderFactory,
    private readonly finalizeService: StreamFinalizeService,
    @Inject(CHAT_CONTEXT_RETRIEVER)
    @Optional()
    private readonly contextRetriever?: ChatContextRetriever,
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
    await this.resolveProvider(userId, dto.provider_key)
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

    // Service 层兜底：即使 DTO 校验通过，空字符串也不应传给 LLM
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new BadRequestException({
        code: 'QUERY_EMPTY',
        message: '输入内容不能为空',
      })
    }

    // 先解析 provider（失败时无需加载历史消息，减少无效数据库压力）
    const { provider, timeoutMs } = await this.resolveProvider(userId, dto.provider_key, dto.model)
    const history = await this.conversationService.loadHistory(sessionId, {
      beforeMessageId: dto.parent_message_id ?? undefined,
    })

    await this.conversationService.saveUserMessage(sessionId, input)

    const messages: LlmMessage[] = history.filter(isLlmMessage)

    // 将当前用户输入追加到 messages。
    // 原因：loadHistory 在 saveUserMessage 之前调用，新会话首条消息时 history 为空。
    // 若不追加，LLM 会收到空 messages 并报 "Empty input messages"。
    messages.push({ role: 'user', content: input })

    if (dto.knowledge_base_ids && dto.knowledge_base_ids.length > 0) {
      if (this.contextRetriever) {
        const { context } = await this.contextRetriever.retrieve(userId, input, {
          kbIds: dto.knowledge_base_ids,
        })
        if (context) {
          // M2: 对 RAG 上下文做基础过滤，防止提示注入
          const sanitizedContext = this.sanitizeRagContext(context)
          // 将上下文拼接到当前 user message 中，而非追加 system message
          // 原因：部分 LLM 对末尾 system message 关注度低，拼接到 user message 可确保上下文被重视
          const userMsgIndex = messages.length - 1
          if (userMsgIndex >= 0 && messages[userMsgIndex].role === 'user') {
            messages[userMsgIndex] = {
              role: 'user',
              content: `${messages[userMsgIndex].content}\n\n以下是与问题相关的上下文信息：\n\n${sanitizedContext}`,
            }
          }
        }
      } else {
        this.logger.warn(
          `收到 knowledge_base_ids 但未注册 ChatContextRetriever，跳过检索。sessionId=${sessionId}`,
        )
      }
    }

    let fullReply = ''
    const MAX_REPLY_LENGTH = 100_000 // H1: 约 100KB 上限，防止内存溢出

    try {
      for await (const chunk of provider.stream(messages, {
        abortSignal: abortController.signal,
      })) {
        // 客户端已断开时提前终止，避免继续消耗 tokens
        if (abortController.signal.aborted) break
        if (chunk.text) {
          fullReply += chunk.text
          // H1: 超限截断，防止 LLM 超长回复导致内存溢出
          if (fullReply.length > MAX_REPLY_LENGTH) {
            this.logger.warn(
              `LLM 回复长度超过上限 ${MAX_REPLY_LENGTH}，已截断。sessionId=${sessionId}`,
            )
            fullReply = fullReply.slice(0, MAX_REPLY_LENGTH)
            break
          }
          yield {
            event: 'message',
            conversation_id: sessionId,
            message_id: messageId,
            answer: chunk.text,
            done: false,
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        yield {
          event: 'error',
          conversation_id: sessionId,
          message_id: messageId,
          answer: '',
          done: true,
          error: `LLM 请求超时（${timeoutMs / 1000} 秒）`,
        }
        return
      }
      this.logger.error(
        `LLM 流异常 sessionId=${sessionId}: ${err instanceof Error ? err.message : '未知错误'}`,
      )
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

    // 客户端在流期间主动取消：不持久化半截回复，也不触发 message_end
    if (abortController.signal.aborted) {
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

    // 流已完整返回：通过门面异步持久化，不阻塞响应
    this.finalizeService.schedule({ userId, sessionId, span: 'chat.stream.finalize' }, [
      {
        name: 'persist-assistant',
        run: () => this.conversationService.saveAssistantMessage(sessionId, messageId, fullReply),
      },
      {
        name: 'generate-title',
        run: () => this.conversationService.generateTitle(sessionId, input, fullReply, provider),
      },
    ])

    yield {
      event: 'message_end',
      conversation_id: sessionId,
      message_id: messageId,
      answer: '',
      done: true,
    }
  }

  private async createProvider(
    providerConfig: { apiKey: string; baseUrl: string; isCompleteUrl: boolean },
    model: string,
    timeoutMs: number,
  ): Promise<LlmProvider> {
    if (!providerConfig.apiKey) {
      throw new BadRequestException({ code: 'LLM_NOT_CONFIGURED', message: '未配置 LLM API Key' })
    }

    const baseURL = resolveLlmBaseURL(providerConfig.baseUrl, providerConfig.isCompleteUrl)
    return this.llmFactory.create('openai-compatible', {
      apiKey: providerConfig.apiKey,
      model,
      baseURL,
      timeout: timeoutMs,
    })
  }

  private async resolveProvider(
    userId: string,
    providerKey?: string,
    dtoModel?: string,
  ): Promise<{
    provider: LlmProvider
    model: string
    timeoutMs: number
  }> {
    const settings = await this.settingsService.getDecryptedSettings(userId)
    const resolvedKey = providerKey?.trim() || settings.chat.defaultProvider

    if (!resolvedKey) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: '未配置 Chat 默认模型提供商',
      })
    }

    // 解析模型级别 key：{providerId}#{modelName} 或纯 {providerId}
    const { providerId: parsedProviderId, modelName: parsedModelName } = parseModelKey(resolvedKey)
    let providerId = parsedProviderId
    let modelName = parsedModelName

    // 优先从注册表查找（注册表存储模型级别 key）
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

    // 从 provider.models 中查找 LLM 模型
    const model = modelName
      ? provider.models.find((m) => m.name === modelName && m.type === 'llm')
      : provider.models.find((m) => m.type === 'llm' && m.enabled)
    if (!model?.enabled) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
        message: `模型提供商 ${providerId} 没有启用的 LLM 模型${modelName ? `：${modelName}` : ''}`,
      })
    }

    const timeoutMs = provider.timeoutMs
    const resolvedModelName = dtoModel ?? model.name
    return {
      provider: await this.createProvider(
        {
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          isCompleteUrl: provider.isCompleteUrl,
        },
        resolvedModelName,
        timeoutMs,
      ),
      model: resolvedModelName,
      timeoutMs,
    }
  }

  /** M2: 对 RAG 检索到的上下文做基础过滤，降低提示注入风险 */
  private sanitizeRagContext(context: string): string {
    // ponytail: 仅移除明显的 System Prompt 残留行，不过度清洗
    return context
      .split('\n')
      .filter((line) => !/^\s*(system|user|assistant)\s*:/i.test(line))
      .join('\n')
      .trim()
  }
}
