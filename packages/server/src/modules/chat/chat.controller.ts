import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { BypassResponse } from '../../common/decorators/bypass-response.decorator.js'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { ChatService } from './chat.service.js'
import { ConversationService } from './conversation.service.js'
import { ModelRegistryService } from './model-registry.service.js'
import { ChatMessagesDto, MessageListQueryDto } from './dto/chat.dto.js'

@Controller('chat-messages')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly conversationService: ConversationService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly sseHelper: SseResponseHelper,
  ) {}

  @Post()
  @BypassResponse()
  async chat(
    @CurrentUser('id') userId: string,
    @Body() dto: ChatMessagesDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.chatService.validateChatAccess(userId, dto)

    const abortController = this.sseHelper.init(req, reply)

    try {
      const stream = this.chatService.streamChat(userId, dto, abortController)
      for await (const chunk of stream) {
        if (!this.sseHelper.write({ event: chunk.event, data: chunk })) {
          break
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      this.sseHelper.writeError(message, {
        conversationId: dto.conversation_id,
      })
    } finally {
      this.sseHelper.end()
    }
  }

  @Get()
  async listMessages(
    @CurrentUser('id') userId: string,
    @Query() query: MessageListQueryDto,
  ) {
    await this.conversationService.ensureOwnership(userId, query.conversation_id)
    return this.conversationService.paginateMessages(query.conversation_id, {
      page: query.page,
      size: query.size,
    })
  }

  @Get('providers')
  async providers() {
    return { providers: this.modelRegistry.list() }
  }
}
