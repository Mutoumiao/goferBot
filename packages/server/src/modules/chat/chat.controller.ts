import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  HttpStatus,
  Req,
} from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { BypassResponse } from '../../common/decorators/bypass-response.decorator.js'
import { ConfigService } from '@nestjs/config'
import { ChatService } from './chat.service.js'
import { ChatMessagesDto } from './dto/chat.dto.js'

const DEFAULT_DEV_SSE_ORIGINS = [
  'http://localhost:1420',
  'tauri://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
]

@Controller('chat-messages')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 为 SSE 原始响应手动注入 CORS 头。
   * 因为 @BypassResponse + reply.raw 绕过了 Fastify 的 onSend 钩子，
   * @fastify/cors 插件无法自动添加头，需要在此补上。
   */
  private setSseCorsHeaders(req: FastifyRequest, reply: FastifyReply) {
    const origin = req.headers.origin
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
    const envOrigin = this.configService.get<string>('CORS_ORIGIN')

    if (isProduction && !envOrigin) {
      // 生产环境必须显式配置 CORS_ORIGIN，否则不暴露 SSE 跨域头
      return
    }

    const allowedOrigins = isProduction
      ? [envOrigin!]
      : [
          ...DEFAULT_DEV_SSE_ORIGINS,
          ...(envOrigin ? [envOrigin] : []),
        ]

    if (!origin) {
      // 无 Origin 时允许匿名跨域，但不携带 credentials
      reply.raw.setHeader('Access-Control-Allow-Origin', '*')
      return
    }

    if (!allowedOrigins.includes(origin)) {
      return
    }

    reply.raw.setHeader('Access-Control-Allow-Origin', origin)
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
    reply.raw.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, X-Requested-With',
    )
    reply.raw.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    )
  }

  @Post()
  @BypassResponse()
  async chat(
    @CurrentUser('id') userId: string,
    @Body() dto: ChatMessagesDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    // 前置校验：会话所有权、provider 可用性、知识库归属。
    // 这些错误在 SSE headers 发送前抛出，由全局 ExceptionFilter 返回标准 JSON 错误。
    await this.chatService.validateChatAccess(userId, dto)

    this.setSseCorsHeaders(req, reply)

    reply.raw.statusCode = HttpStatus.OK
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')

    let abortController: AbortController | null = null

    // 客户端断开时取消 LLM 请求
    const onClose = () => {
      abortController?.abort()
    }
    reply.raw.on('close', onClose)

    try {
      const stream = this.chatService.streamChat(userId, dto, (ac) => {
        abortController = ac
      })
      for await (const chunk of stream) {
        if (reply.raw.destroyed) break
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      reply.raw.write(
        `data: ${JSON.stringify({ event: 'message', conversation_id: dto.conversation_id, message_id: '', answer: '', done: true, error: message })}\n\n`,
      )
    } finally {
      reply.raw.removeListener('close', onClose)
      reply.raw.end()
    }
  }
}
