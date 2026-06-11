import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { ChatDto } from './dto/chat.dto.js'
import { RagService } from './rag.service.js'
import { SettingsService } from '../settings/settings.service.js'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

interface ChatChunk {
  chunk: string
  done: boolean
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
  ) {
    const envTimeout = process.env.LLM_TIMEOUT_MS
    const parsed = envTimeout ? parseInt(envTimeout, 10) : 300000
    this.llmTimeoutMs = Number.isNaN(parsed) ? 300000 : parsed
  }

  private async createChatModel(userId: string): Promise<ChatOpenAI> {
    const settings = await this.settingsService.getSettings(userId)
    const providers = settings.providers as Record<string, { name: string; apiKey: string; model: string; baseUrl: string }>
    const defaultProvider = settings.defaultChatProvider as string
    const provider = providers[defaultProvider]

    // 内置模型：从环境变量读取
    const builtInKeys = ['openai', 'claude', 'deepseek']
    if (builtInKeys.includes(defaultProvider)) {
      const envApiKey = this.configService.get<string>(`${defaultProvider.toUpperCase()}_API_KEY`)
      const envBaseUrl = this.configService.get<string>(`${defaultProvider.toUpperCase()}_BASE_URL`)
      const envModel = this.configService.get<string>(`${defaultProvider.toUpperCase()}_MODEL`)

      const apiKey = envApiKey || provider?.apiKey || ''
      const baseUrl = envBaseUrl || provider?.baseUrl || 'https://api.openai.com'
      const model = envModel || provider?.model || 'gpt-3.5-turbo'

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

    // 自定义模型：从用户设置读取
    if (!provider?.apiKey) {
      throw new BadRequestException({ code: 'LLM_NOT_CONFIGURED', message: '未配置 LLM API Key' })
    }

    return new ChatOpenAI({
      apiKey: provider.apiKey,
      model: provider.model,
      streaming: true,
      timeout: this.llmTimeoutMs,
      configuration: {
        baseURL: provider.baseUrl || undefined,
      },
    })
  }

  async *streamChat(
    userId: string,
    dto: ChatDto,
    onAbortController?: (ac: AbortController) => void,
  ): AsyncGenerator<ChatChunk> {
    const { input, sessionId, lastMessageId } = dto

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
    const historyWhere: { sessionId: string; id?: { lte: string } } = { sessionId }
    if (lastMessageId) {
      historyWhere.id = { lte: lastMessageId }
    }

    const historyMessages = await this.prisma.message.findMany({
      where: historyWhere,
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    const llmMessages: Array<{ role: string; content: string }> = []

    // RAG 检索：当 knowledgeBaseIds 存在时检索相关 chunks 并注入 system message
    if (dto.knowledgeBaseIds && dto.knowledgeBaseIds.length > 0) {
      const result = await this.ragService.retrieveContext({
        original: input,
        kbIds: dto.knowledgeBaseIds,
      })
      if (result.context) {
        llmMessages.push({ role: 'system', content: `基于以下上下文回答问题：\n${result.context}` })
      }
    }

    historyMessages.forEach((m) => llmMessages.push({ role: m.role, content: m.content }))

    const chat = await this.createChatModel(userId)

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
          yield { chunk: text, done: false }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          code: 'LLM_TIMEOUT',
          message: 'LLM 请求超时（5 分钟）',
        })
      }
      throw err
    }

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
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

    yield { chunk: '', done: true }
  }

  private async ensureSessionOwnership(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      throw new BadRequestException({
        code: 'NOT_FOUND',
        message: '会话不存在',
      })
    }

    if (session.userId !== userId) {
      throw new BadRequestException({
        code: 'FORBIDDEN',
        message: '无权访问该会话',
      })
    }
  }
}
