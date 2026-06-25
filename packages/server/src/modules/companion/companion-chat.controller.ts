import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { BypassResponse } from '../../common/decorators/bypass-response.decorator.js'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { CompanionChatService } from './companion-chat.service.js'
import {
  CreateFeedbackDto,
  MemoryListQueryDto,
  MessageListQueryDto,
  SendMessageDto,
} from './dto/companion.dto.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionFeedbackRepository } from './repositories/companion-feedback.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

@Controller('companion')
@UseGuards(JwtAuthGuard)
export class CompanionChatController {
  private readonly logger = new Logger(CompanionChatController.name)

  constructor(
    private readonly chatService: CompanionChatService,
    private readonly companionRepo: CompanionRepository,
    private readonly conversationRepo: CompanionConversationRepository,
    private readonly messageRepo: CompanionMessageRepository,
    private readonly feedbackRepo: CompanionFeedbackRepository,
    private readonly memoryRepo: CompanionMemoryRepository,
    private readonly sseHelper: SseResponseHelper,
  ) {}

  @Post('chat')
  @BypassResponse()
  async streamChat(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const abortController = this.sseHelper.init(req, reply)

    try {
      const conversation = await this.conversationRepo.findByIdAndAuthorize(
        dto.conversationId,
        userId,
      )

      const stream = this.chatService.streamChat({
        userId,
        companionId: conversation.companionId,
        message: dto.content,
        conversationId: dto.conversationId,
        signal: abortController.signal,
      })

      for await (const event of stream) {
        if (!this.sseHelper.write({ event: event.event, data: event.data })) {
          break
        }
      }
    } catch (err: unknown) {
      this.logger.error(`SSE 流异常: ${err instanceof Error ? err.message : '未知错误'}`)
      this.sseHelper.writeError('服务暂时不可用，请稍后重试', {
        conversationId: dto.conversationId,
      })
    } finally {
      this.sseHelper.end()
    }
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Query() query: MessageListQueryDto,
  ) {
    await this.conversationRepo.findByIdAndAuthorize(conversationId, userId)

    const result = await this.messageRepo.findByUserAndConversation(conversationId, userId, {
      page: query.page ?? 1,
      size: query.size ?? 20,
    })

    return { items: result.data, pagination: result.pagination }
  }

  @Post('messages/:id/feedback')
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    const message = await this.messageRepo.findByIdAndAuthorize(messageId, userId)

    const feedback = await this.feedbackRepo.upsert(messageId, {
      userId,
      companionId: message.conversation.companionId,
      conversationId: message.conversationId,
      rating: dto.rating,
      reason: dto.reason,
      note: dto.note,
    })

    return {
      id: feedback.id,
      messageId: feedback.messageId,
      rating: feedback.rating,
      reason: feedback.reason,
      note: feedback.note,
    }
  }

  @Get('memories')
  async listMemories(@CurrentUser('id') userId: string, @Query() query: MemoryListQueryDto) {
    if (!query.companionId) {
      throw new BadRequestException('companionId is required')
    }
    await this.companionRepo.findByIdAndAuthorize(query.companionId, userId)

    const result = await this.memoryRepo.findByCompanionAndUser(query.companionId, userId, {
      page: query.page ?? 1,
      size: query.size ?? 20,
      status: query.status,
    })

    return { items: result.data, pagination: result.pagination }
  }
}
