import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { SessionService } from '../session/session.service.js'
import { MessageListQueryDto } from './dto/chat.dto.js'

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: MessageListQueryDto,
  ) {
    const result = await this.sessionService.listMessages(
      userId,
      query.conversation_id,
      { page: 1, limit: query.limit },
    )

    return {
      limit: query.limit,
      has_more: result.hasMore,
      data: result.messages,
    }
  }
}
