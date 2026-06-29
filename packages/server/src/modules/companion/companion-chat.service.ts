import { Injectable } from '@nestjs/common'
import type { ChatStreamEvent, StreamChatParams } from './companion-chat.types.js'
import { CompanionChatStreamService } from './companion-chat-stream.service.js'

@Injectable()
export class CompanionChatService {
  constructor(private readonly streamService: CompanionChatStreamService) {}

  async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
    yield* this.streamService.streamChat(params)
  }
}
