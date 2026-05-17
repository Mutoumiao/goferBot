import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { BypassResponse } from '../../common/decorators/bypass-response.decorator.js'
import { ChatService } from './chat.service.js'
import { ChatDto, chatSchema } from './dto/chat.dto.js'

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @BypassResponse()
  async chat(
    @CurrentUser('id' as never) userId: string,
    @Body(new ZodValidationPipe(chatSchema)) dto: ChatDto,
    @Res() reply: FastifyReply,
  ) {
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
        `data: ${JSON.stringify({ error: message, done: true })}\n\n`,
      )
      reply.raw.end()
      return
    } finally {
      reply.raw.removeListener('close', onClose)
      reply.raw.end()
    }
  }
}
