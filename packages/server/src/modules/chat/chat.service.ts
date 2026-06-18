import { randomUUID } from 'node:crypto'
import type { ChatMessagesChunk } from '@goferbot/data'
import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SettingsService } from '../settings/settings.service.js'
import { ConversationService } from './conversation.service.js'
import type { ChatMessagesDto } from './dto/chat.dto.js'
import {
  CHAT_CONTEXT_RETRIEVER,
  type ChatContextRetriever,
} from './interfaces/chat-context-retriever.interface.js'
import { LlmProviderFactory } from './llm/llm-provider.factory.js'
import type { LlmMessage, LlmProvider } from './llm/llm-provider.interface.js'
import { type ModelInfo, ModelRegistryService } from './model-registry.service.js'

function isLlmMessage(m: { role: string; content: string }): m is LlmMessage {
  return m.role === 'system' || m.role === 'user' || m.role === 'assistant'
}

@Injectable()
export class ChatService {
  private readonly llmTimeoutMs: number
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly conversationService: ConversationService,
    private readonly llmFactory: LlmProviderFactory,
    @Inject(CHAT_CONTEXT_RETRIEVER)
    @Optional()
    private readonly contextRetriever?: ChatContextRetriever,
  ) {
    const parsed = this.configService.get<number>('LLM_TIMEOUT_MS', 300_000)
    this.llmTimeoutMs = Number.isNaN(parsed) ? 300_000 : parsed
  }

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
    const provider = await this.createProvider(userId, dto.provider_key, dto.model)
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
          messages.push({
            role: 'system',
            content: `以下是与用户问题相关的上下文信息：\n\n${context}`,
          })
        }
      } else {
        this.logger.warn(
          `收到 knowledge_base_ids 但未注册 ChatContextRetriever，跳过检索。sessionId=${sessionId}`,
        )
      }
    }

    let fullReply = ''

    try {
      for await (const chunk of provider.stream(messages, {
        abortSignal: abortController.signal,
      })) {
        // 客户端已断开时提前终止，避免继续消耗 tokens
        if (abortController.signal.aborted) break
        if (chunk.text) {
          fullReply += chunk.text
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
          error: `LLM 请求超时（${this.llmTimeoutMs / 1000} 秒）`,
        }
        return
      }
      const message = err instanceof Error ? err.message : '未知错误'
      yield {
        event: 'error',
        conversation_id: sessionId,
        message_id: messageId,
        answer: '',
        done: true,
        error: message,
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

    try {
      await this.conversationService.saveAssistantMessage(sessionId, messageId, fullReply)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      this.logger.error(`保存 assistant 消息失败 sessionId=${sessionId}: ${message}`)
      yield {
        event: 'error',
        conversation_id: sessionId,
        message_id: messageId,
        answer: '',
        done: true,
        error: `回复保存失败: ${message}`,
      }
      return
    }

    if (fullReply) {
      this.conversationService
        .generateTitle(sessionId, input, fullReply, provider)
        .catch((err: unknown) => {
          this.logger.error(
            `生成会话标题失败 sessionId=${sessionId}: ${err instanceof Error ? err.message : '未知错误'}`,
          )
        })
    }

    yield {
      event: 'message_end',
      conversation_id: sessionId,
      message_id: messageId,
      answer: '',
      done: true,
    }
  }

  private async createProvider(
    userId: string,
    providerKey?: string,
    dtoModel?: string,
  ): Promise<LlmProvider> {
    const {
      resolvedKey,
      provider: providerConfig,
      modelInfo,
    } = await this.resolveProvider(userId, providerKey)

    let apiKey: string
    let baseURL: string
    let model: string

    if (modelInfo) {
      // 内置模型：使用模型注册中心中的 providerKey 读取环境变量，避免将用户传入的 provider_key 拼入环境变量名
      const envApiKey = this.configService.get<string>(
        `${modelInfo.providerKey.toUpperCase()}_API_KEY`,
      )
      const envBaseUrl = this.configService.get<string>(
        `${modelInfo.providerKey.toUpperCase()}_BASE_URL`,
      )
      const envModel = this.configService.get<string>(
        `${modelInfo.providerKey.toUpperCase()}_MODEL`,
      )
      apiKey = envApiKey ?? ''
      baseURL = envBaseUrl ?? modelInfo.baseUrl
      model = dtoModel ?? envModel ?? resolvedKey
    } else {
      // 用户自定义 provider：使用 settings 中的配置，不再读取环境变量，防止通过 provider_key 探测服务端 secrets
      apiKey = providerConfig.apiKey ?? ''
      baseURL = providerConfig.baseUrl ?? 'https://api.openai.com'
      model = dtoModel ?? providerConfig.model ?? 'gpt-3.5-turbo'
    }

    if (!apiKey) {
      throw new BadRequestException({ code: 'LLM_NOT_CONFIGURED', message: '未配置 LLM API Key' })
    }

    return this.llmFactory.create('openai-compatible', {
      apiKey,
      model,
      baseURL,
      timeout: this.llmTimeoutMs,
    })
  }

  private async resolveProvider(
    userId: string,
    providerKey?: string,
  ): Promise<{
    providerKey: string
    resolvedKey: string
    provider: { name: string; apiKey: string; model: string; baseUrl: string }
    modelInfo?: ModelInfo
  }> {
    const settings = await this.settingsService.getDecryptedSettings(userId)
    const providers = settings.providers as Record<
      string,
      { name: string; apiKey: string; model: string; baseUrl: string }
    >
    const defaultProvider = settings.defaultChatProvider as string

    const resolvedKey = providerKey?.trim() || defaultProvider

    const modelInfo = this.modelRegistry.lookup(resolvedKey)
    if (modelInfo) {
      return {
        providerKey: modelInfo.providerKey,
        resolvedKey,
        provider: {
          name: modelInfo.providerName,
          apiKey: '',
          model: resolvedKey,
          baseUrl: modelInfo.baseUrl,
        },
        modelInfo,
      }
    }

    if (!resolvedKey || !providers || !Object.hasOwn(providers, resolvedKey)) {
      throw new BadRequestException({
        code: 'PROVIDER_INVALID',
        message: `未配置的 provider: ${resolvedKey ?? '空'}`,
      })
    }

    return { providerKey: resolvedKey, resolvedKey, provider: providers[resolvedKey] }
  }
}
