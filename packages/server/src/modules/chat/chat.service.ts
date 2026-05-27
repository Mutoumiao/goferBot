import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { ChatDto } from './dto/chat.dto.js'

interface ChatChunk {
  chunk: string
  done: boolean
}

@Injectable()
export class ChatService {
  private readonly llmTimeoutMs: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const envTimeout = process.env.LLM_TIMEOUT_MS
    this.llmTimeoutMs = envTimeout ? parseInt(envTimeout, 10) : 300000
  }

  async *streamChat(
    userId: string,
    dto: ChatDto,
    onAbortController?: (ac: AbortController) => void,
  ): AsyncGenerator<ChatChunk> {
    const { message, sessionId, config } = dto

    await this.ensureSessionOwnership(userId, sessionId)

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          content: message,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      }),
    ])

    // 加载历史消息用于多轮对话上下文
    const historyMessages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    // TODO(phase-5): 接入 RAG 检索，将检索结果注入 system 消息
    const llmMessages = historyMessages.map((m) => ({ role: m.role, content: m.content }))

    let fullReply = ''
    const abortController = new AbortController()
    onAbortController?.(abortController)
    const timeout = setTimeout(() => {
      abortController.abort()
    }, this.llmTimeoutMs)

    try {
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: llmMessages,
          stream: true,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new ServiceUnavailableException({
          code: 'LLM_ERROR',
          message: `LLM 请求失败: ${response.status} ${body.slice(0, 200)}`,
        })
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new ServiceUnavailableException({
          code: 'LLM_ERROR',
          message: 'LLM 响应为空',
        })
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (typeof delta === 'string') {
              fullReply += delta
              yield { chunk: delta, done: false }
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      // 处理剩余 buffer
      if (buffer.trim().startsWith('data: ')) {
        const data = buffer.trim().slice(6)
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (typeof delta === 'string') {
              fullReply += delta
              yield { chunk: delta, done: false }
            }
          } catch {
            // 忽略
          }
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
    } finally {
      clearTimeout(timeout)
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
