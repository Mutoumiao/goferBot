import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { ChatMessagesDto } from './dto/chat.dto.js'
import { RagService } from './rag.service.js'
import { SettingsService } from '../settings/settings.service.js'
import { ModelRegistryService } from './model-registry.service.js'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { randomUUID } from 'crypto'

const DEFAULT_LLM_TIMEOUT_MS = 300_000
const DEFAULT_LLM_BASE_URL = 'https://api.openai.com'
const DEFAULT_LLM_MODEL = 'gpt-3.5-turbo'
const DEFAULT_SESSION_TITLE = '新对话'
const DEFAULT_SESSION_TITLE_ALTERNATIVE = '会话页'
const MAX_SESSION_TITLE_LENGTH = 30

interface ChatChunk {
  event: 'message'
  conversation_id: string
  message_id: string
  answer: string
  done?: boolean
  error?: string
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly llmTimeoutMs: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ragService: RagService,
    private readonly settingsService: SettingsService,
    private readonly modelRegistry: ModelRegistryService,
  ) {
    const parsed = this.configService.get<number>('LLM_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS)
    this.llmTimeoutMs = Number.isNaN(parsed) ? DEFAULT_LLM_TIMEOUT_MS : parsed
  }

  /**
   * 根据 dto.providerKey 或用户默认设置解析出最终使用的 provider 键。
   * - 若 dto.providerKey 提供且合法则使用该 provider；
   * - 否则回退到 settings.defaultChatProvider；
   * - 若最终 provider 不在配置中（或非法）则抛 BadRequestException。
   */
  private async resolveProvider(
    userId: string,
    providerKey?: string,
  ): Promise<{
    providerKey: string
    providers: Record<string, { name: string; apiKey: string; model: string; baseUrl: string }>
  }> {
    const settings = await this.settingsService.getSettings(userId)
    const providers = settings.providers as Record<
      string,
      { name: string; apiKey: string; model: string; baseUrl: string }
    >
    const defaultProvider = settings.defaultChatProvider as string

    const resolvedKey = providerKey && providerKey.trim()
      ? providerKey.trim()
      : defaultProvider

    const modelInfo = this.modelRegistry.lookup(resolvedKey)
    if (modelInfo) {
      return {
        providerKey: modelInfo.providerKey,
        providers: {
          [modelInfo.providerKey]: {
            name: modelInfo.providerName,
            apiKey: '',
            model: resolvedKey,
            baseUrl: modelInfo.baseUrl,
          },
        },
      }
    }

    if (!resolvedKey || !providers || !Object.prototype.hasOwnProperty.call(providers, resolvedKey)) {
      throw new BadRequestException({
        code: 'PROVIDER_INVALID',
        message: `未配置的 provider: ${resolvedKey ?? '空'}`,
      })
    }

    return { providerKey: resolvedKey, providers }
  }

  private async createChatModel(
    userId: string,
    providerKey?: string,
    dtoModel?: string,
  ): Promise<ChatOpenAI> {
    const { providerKey: resolvedKey, providers } = await this.resolveProvider(userId, providerKey)

    const provider = providers[resolvedKey]

    const envApiKey = this.configService.get<string>(`${resolvedKey.toUpperCase()}_API_KEY`)
    const envBaseUrl = this.configService.get<string>(`${resolvedKey.toUpperCase()}_BASE_URL`)
    const envModel = this.configService.get<string>(`${resolvedKey.toUpperCase()}_MODEL`)

    const apiKey = envApiKey || provider?.apiKey || ''
    const baseUrl = envBaseUrl || provider?.baseUrl || DEFAULT_LLM_BASE_URL
    const model = dtoModel || envModel || provider?.model || DEFAULT_LLM_MODEL

    if (!apiKey) {
      throw new BadRequestException({ code: 'LLM_NOT_CONFIGURED', message: '未配置 LLM API Key' })
    }

    return new ChatOpenAI({
      apiKey,
      model,
      streaming: true,
      timeout: this.llmTimeoutMs,
      configuration: {
        baseURL: baseUrl,
      },
    })
  }

  async validateChatAccess(userId: string, dto: ChatMessagesDto): Promise<void> {
    const sessionId = dto.conversation_id
    if (!sessionId) {
      throw new BadRequestException({
        code: 'CONVERSATION_ID_REQUIRED',
        message: 'conversation_id 不能为空',
      })
    }

    await this.ensureSessionOwnership(userId, sessionId)
    await this.resolveProvider(userId, dto.provider_key)

    if (dto.knowledge_base_ids && dto.knowledge_base_ids.length > 0) {
      await this.ensureKnowledgeBaseOwnership(userId, dto.knowledge_base_ids)
    }
  }

  async *streamChat(
    userId: string,
    dto: ChatMessagesDto,
    onAbortController?: (ac: AbortController) => void,
  ): AsyncGenerator<ChatChunk> {
    const messageId = randomUUID()
    const sessionId = dto.conversation_id
    const input = dto.query
    const lastMessageId = dto.parent_message_id ?? undefined

    if (!sessionId) {
      throw new BadRequestException({
        code: 'CONVERSATION_ID_REQUIRED',
        message: 'conversation_id 不能为空',
      })
    }

    await this.ensureSessionOwnership(userId, sessionId)

    // 保存用户输入
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          content: input,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      }),
    ])

    // 加载历史消息用于多轮对话上下文
    const historyWhere: { sessionId: string; createdAt?: { lte: Date } } = { sessionId }
    if (lastMessageId) {
      const lastMessage = await this.prisma.message.findUnique({
        where: { id: lastMessageId },
        select: { createdAt: true, sessionId: true },
      })
      if (!lastMessage) {
        throw new BadRequestException({
          code: 'PARENT_MESSAGE_NOT_FOUND',
          message: 'parent_message_id 不存在',
        })
      }
      if (lastMessage.sessionId !== sessionId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'parent_message_id 不属于当前会话',
        })
      }
      historyWhere.createdAt = { lte: lastMessage.createdAt }
    }

    const historyMessages = await this.prisma.message.findMany({
      where: historyWhere,
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    const llmMessages: Array<{ role: string; content: string }> = []

    // 校验请求检索的知识库均属于当前用户
    if (dto.knowledge_base_ids && dto.knowledge_base_ids.length > 0) {
      await this.ensureKnowledgeBaseOwnership(userId, dto.knowledge_base_ids)
    }

    // RAG 检索：当 knowledge_base_ids 存在时检索相关 chunks 并注入 system message
    if (dto.knowledge_base_ids && dto.knowledge_base_ids.length > 0) {
      try {
        const result = await this.ragService.retrieveContext({
          original: input,
          kbIds: dto.knowledge_base_ids,
        })
        if (result.context) {
          llmMessages.push({ role: 'system', content: `基于以下上下文回答问题：\n${result.context}` })
        }
      } catch (err: unknown) {
        this.logger.warn('RAG retrieval failed, falling back to plain LLM', err)
      }
    }

    historyMessages.forEach((m) => llmMessages.push({ role: m.role, content: m.content }))

    const chat = await this.createChatModel(userId, dto.provider_key, dto.model)

    // 将 messages 数组转换为 LangChain BaseMessage 格式
    const createMessage = (role: string, content: string): BaseMessage => {
      switch (role) {
        case 'system':
          return new SystemMessage(content)
        case 'user':
          return new HumanMessage(content)
        case 'assistant':
          return new AIMessage(content)
        default:
          return new HumanMessage(content)
      }
    }
    const lcMessages: BaseMessage[] = llmMessages.map((m) => createMessage(m.role, m.content))

    let fullReply = ''
    const abortController = new AbortController()
    onAbortController?.(abortController)

    try {
      const stream = await chat.stream(lcMessages, {
        signal: abortController.signal,
      })

      for await (const chunk of stream) {
        const content = chunk?.content
        const text = Array.isArray(content)
          ? content.map((c) => (typeof c === 'string' ? c : c.text ?? '')).join('')
          : (content ?? '')
        if (text) {
          fullReply += text
          yield { event: 'message', conversation_id: sessionId, message_id: messageId, answer: text, done: false }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        yield { event: 'message', conversation_id: sessionId, message_id: messageId, answer: '', done: true, error: `LLM 请求超时（${this.llmTimeoutMs / 1000} 秒）` }
        return
      }
      const message = err instanceof Error ? err.message : '未知错误'
      yield { event: 'message', conversation_id: sessionId, message_id: messageId, answer: '', done: true, error: message }
      return
    }

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          id: messageId,
          sessionId,
          role: 'assistant',
          content: fullReply,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      }),
    ])

    // 异步生成标题，不阻塞 SSE
    if (fullReply) {
      this.generateSessionTitle(userId, sessionId, input, fullReply).catch(() => { })
    }

    yield { event: 'message', conversation_id: sessionId, message_id: messageId, answer: '', done: true }
  }

  private async generateSessionTitle(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { title: true },
    })
    if (!session || (session.title !== DEFAULT_SESSION_TITLE && session.title !== DEFAULT_SESSION_TITLE_ALTERNATIVE)) return

    try {
      const chat = await this.createChatModel(userId)
      const messages = [
        new SystemMessage('你是一个标题生成助手。请根据对话内容生成一个5-10字的简短中文标题，只返回标题本身，不要有任何额外内容或标点解释。'),
        new HumanMessage(`用户：${userMessage}\nAI：${assistantMessage}`),
      ]
      const response = await chat.invoke(messages)
      let title = typeof response.content === 'string' ? response.content.trim() : DEFAULT_SESSION_TITLE
      title = title.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').replace(/^["']|["']$/g, '').trim()
      if (!title) title = DEFAULT_SESSION_TITLE
      if (title.length > MAX_SESSION_TITLE_LENGTH) title = title.slice(0, MAX_SESSION_TITLE_LENGTH)

      await this.prisma.session.update({
        where: { id: sessionId },
        data: { title },
      })
    } catch (err: unknown) {
      this.logger.warn('生成会话标题失败', err)
    }
  }

  private async ensureSessionOwnership(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '会话不存在',
      })
    }

    if (session.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该会话',
      })
    }
  }

  private async ensureKnowledgeBaseOwnership(userId: string, kbIds: string[]) {
    const uniqueKbIds = Array.from(new Set(kbIds))
    const ownedCount = await this.prisma.knowledgeBase.count({
      where: {
        userId,
        id: { in: uniqueKbIds },
      },
    })

    if (ownedCount !== uniqueKbIds.length) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问指定的知识库',
      })
    }
  }
}
