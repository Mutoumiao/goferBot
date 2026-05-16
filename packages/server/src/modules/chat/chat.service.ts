import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { ChatDto } from './dto/chat.dto.js'

interface ChatChunk {
  chunk: string
  done: boolean
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async *streamChat(userId: string, dto: ChatDto): AsyncGenerator<ChatChunk> {
    const { message, sessionId, config } = dto

    await this.ensureSessionOwnership(userId, sessionId)

    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
      },
    })

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

    const llmMessages = [{ role: 'user', content: message }]

    let fullReply = ''
    const abortController = new AbortController()
    const timeout = setTimeout(() => {
      abortController.abort()
    }, 30000)

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
          message: 'LLM 请求超时（30 秒）',
        })
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullReply,
      },
    })

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

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
